// Pruebas de las ISSUES 25 (calificaciones) y 26 (notificaciones, recordatorios y soporte).
// Usan el mismo Firestore en memoria de request-service.test.js, ampliado con create/update.
import assert from "node:assert/strict";
import test from "node:test";
import { createRequestService } from "../src/services/request-service.js";
import { createSupportService } from "../src/services/support-service.js";

const clientUid = "client-uid";
const providerUid = "provider-uid";
const input = {
  providerCatalogId: "provider-catalog-1",
  categoryId: "plomeria",
  date: "2026-11-25",
  time: "10:00",
  address: "Calle 45 #28-10",
  detail: "Reparación de una fuga en el lavaplatos.",
};
const idempotencyKey = "request-key-000001";
const completeProfile = {
  bio: "Profesional con experiencia en servicios confiables para el hogar.",
  experienceYears: 5,
  coverageZone: "Bogotá",
  availability: "Lunes a sábado",
  services: ["plomeria"],
  automaticValidation: { status: "passed" },
  adminApproval: { status: "approved" },
};

function clone(value) {
  return structuredClone(value);
}

class MemoryDocumentReference {
  constructor(store, collectionName, id) {
    this.store = store;
    this.collectionName = collectionName;
    this.id = id;
  }

  get key() {
    return `${this.collectionName}/${this.id}`;
  }

  async get() {
    this.store.maybeFail("get");
    const data = this.store.documents.get(this.key);
    return {
      id: this.id,
      exists: data !== undefined,
      data: () => clone(data),
      get: (field) => (data === undefined ? undefined : clone(data)[field]),
      ref: this,
    };
  }

  async create(data) {
    if (this.store.documents.has(this.key)) throw new Error("Document already exists");
    this.store.documents.set(this.key, clone(data));
  }

  async update(data) {
    if (!this.store.documents.has(this.key)) throw new Error("Document does not exist");
    this.store.documents.set(this.key, { ...this.store.documents.get(this.key), ...clone(data) });
  }

  collection(name) {
    return new MemoryCollectionReference(this.store, `${this.key}/${name}`);
  }
}

class MemoryCollectionReference {
  constructor(store, name) {
    this.store = store;
    this.name = name;
  }

  doc(id) {
    const documentId = id || `generated-${++this.store.nextId}`;
    return new MemoryDocumentReference(this.store, this.name, documentId);
  }

  where(field, operator, value) {
    return new MemoryQuery(this.store, this.name).where(field, operator, value);
  }
}

class MemoryQuery {
  constructor(store, collectionName) {
    this.store = store;
    this.collectionName = collectionName;
    this.filters = [];
    this.maxResults = 50;
  }

  where(field, operator, value) {
    this.filters.push({ field, operator, value });
    return this;
  }

  orderBy() {
    return this;
  }

  limit(value) {
    this.maxResults = value;
    return this;
  }

  async get() {
    this.store.maybeFail("query");
    const prefix = `${this.collectionName}/`;
    const docs = [...this.store.documents.entries()]
      .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
      .map(([key, data]) => ({
        id: key.slice(prefix.length),
        data,
      }))
      .filter(({ data }) =>
        this.filters.every(
          ({ field, operator, value }) => operator === "==" && data[field] === value,
        ),
      )
      .slice(0, this.maxResults)
      .map(({ id, data }) => ({
        id,
        data: () => clone(data),
      }));
    return { docs };
  }
}

class MemoryFirestore {
  constructor() {
    this.documents = new Map();
    this.nextId = 0;
    this.failure = null;
  }

  collection(name) {
    return new MemoryCollectionReference(this, name);
  }

  seed(collection, id, data) {
    this.documents.set(`${collection}/${id}`, clone(data));
  }

  read(collection, id) {
    return clone(this.documents.get(`${collection}/${id}`));
  }

  maybeFail(operation) {
    if (this.failure === operation) {
      throw Object.assign(new Error("Firestore unavailable"), { code: "unavailable" });
    }
  }

  async runTransaction(operation) {
    this.maybeFail("transaction");
    const writes = [];
    const transaction = {
      get: async (reference) => {
        this.maybeFail("transactionGet");
        return reference.get();
      },
      set: (reference, data, options = {}) =>
        writes.push({ kind: "set", reference, data: clone(data), merge: options.merge }),
      update: (reference, data) =>
        writes.push({ kind: "update", reference, data: clone(data) }),
      create: (reference, data) => {
        if (this.documents.has(reference.key)) {
          throw Object.assign(new Error("Document already exists"), { code: "already-exists" });
        }
        writes.push({ kind: "set", reference, data: clone(data) });
      },
    };
    const result = await operation(transaction);
    this.maybeFail("transactionCommit");
    for (const write of writes) {
      const current = this.documents.get(write.reference.key);
      if (write.kind === "update" && !current) {
        throw Object.assign(new Error("Document does not exist"), { code: "not-found" });
      }
      const next =
        write.merge && current ? { ...current, ...write.data } : { ...(current || {}), ...write.data };
      this.documents.set(write.reference.key, next);
    }
    return result;
  }
}

function seedService({ catalogActive = true, categoryActive = true, profile = completeProfile } = {}) {
  const db = new MemoryFirestore();
  db.seed("users", clientUid, {
    role: "Cliente",
    firstName: "Ana",
    lastName: "Pérez",
  });
  db.seed("users", providerUid, {
    role: "Proveedor",
    firstName: "Carmen",
    lastName: "Díaz",
  });
  db.seed("providerProfiles", providerUid, profile);
  db.seed("providerCatalog", input.providerCatalogId, {
    providerUid,
    active: catalogActive,
  });
  db.seed("categories", input.categoryId, {
    active: categoryActive,
    name: "Plomería",
    fixedPriceCOP: 35000,
    durationMinutes: 60,
  });

  const profileService = {
    async getProviderEligibility(uid) {
      return { eligible: uid === providerUid && profile === completeProfile };
    },
  };
  const service = createRequestService({
    db,
    profileService,
    now: () => new Date("2026-11-20T15:00:00.000Z"),
  });
  return { db, service };
}

async function create(service, overrides = {}) {
  return service.createRequest({
    clientUid,
    input,
    idempotencyKey,
    ...overrides,
  });
}


const now = () => new Date("2026-11-20T15:00:00.000Z");
const move = (service, id, action, actor = "Proveedor") =>
  service.transitionRequest({
    requestId: id,
    actorUid: actor === "Proveedor" ? providerUid : clientUid,
    actorRole: actor,
    action,
  });

async function completedRequest() {
  const seeded = seedService();
  const created = await create(seeded.service);
  await move(seeded.service, created.id, "accept");
  await move(seeded.service, created.id, "confirm", "Cliente");
  await move(seeded.service, created.id, "start");
  await move(seeded.service, created.id, "complete");
  return { ...seeded, id: created.id };
}

/* ---------- ISSUE 25: calificaciones ---------- */

test("ISSUE 25: solo se califica un servicio completado", async () => {
  const { service } = seedService();
  const created = await create(service);
  await assert.rejects(
    service.createRating({ requestId: created.id, clientUid, input: { rating: 5, comment: "" } }),
    (error) => error.statusCode === 409 && error.code === "REQUEST_NOT_COMPLETED",
  );
});

test("ISSUE 25: guarda 1-5 estrellas y comentario asociado a cliente, proveedor y servicio", async () => {
  const { db, service, id } = await completedRequest();
  const rating = await service.createRating({
    requestId: id,
    clientUid,
    input: { rating: 4, comment: "  Muy puntual  " },
  });
  assert.equal(rating.rating, 4);
  assert.equal(rating.comment, "Muy puntual");
  const stored = db.read("ratings", id);
  assert.equal(stored.serviceId, id);
  assert.equal(stored.clientUid, clientUid);
  assert.equal(stored.providerUid, providerUid);
  assert.equal(stored.clientDisplayName, "Ana Pérez");
});

test("ISSUE 25: no permite calificaciones duplicadas del mismo servicio", async () => {
  const { service, id } = await completedRequest();
  await service.createRating({ requestId: id, clientUid, input: { rating: 5, comment: "" } });
  await assert.rejects(
    service.createRating({ requestId: id, clientUid, input: { rating: 1, comment: "" } }),
    (error) => error.statusCode === 409 && error.code === "RATING_ALREADY_EXISTS",
  );
});

test("ISSUE 25: rechaza estrellas fuera de 1-5, decimales y campos extra", async () => {
  const { service, id } = await completedRequest();
  for (const input of [
    { rating: 0, comment: "" },
    { rating: 6, comment: "" },
    { rating: 4.5, comment: "" },
    { rating: "5", comment: "" },
    { rating: 5 },
    { rating: 5, comment: "x".repeat(1001) },
  ]) {
    await assert.rejects(service.createRating({ requestId: id, clientUid, input }), (error) => error.statusCode === 400);
  }
  await assert.rejects(
    service.createRating({ requestId: id, clientUid, input: { rating: 5, comment: "", providerUid: "otro" } }),
    (error) => error.code === "PROTECTED_RATING_FIELDS",
  );
});

test("ISSUE 25: otro cliente no puede calificar ni ver la calificación ajena", async () => {
  const { service, id } = await completedRequest();
  await assert.rejects(
    service.createRating({ requestId: id, clientUid: "intruso", input: { rating: 1, comment: "" } }),
    (error) => error.statusCode === 404,
  );
  await assert.rejects(service.getRequestRating({ requestId: id, clientUid: "intruso" }), (error) => error.statusCode === 404);
});

test("ISSUE 25: calcula bien el promedio del proveedor", async () => {
  const { db, service } = seedService();
  const ids = [];
  for (const [index, stars] of [5, 4, 2].entries()) {
    const created = await create(service, { idempotencyKey: `request-key-00000${index + 2}`, input: { ...input, detail: `Detalle de prueba número ${index}` } });
    await move(service, created.id, "accept");
    await move(service, created.id, "confirm", "Cliente");
    await move(service, created.id, "start");
    await move(service, created.id, "complete");
    await service.createRating({ requestId: created.id, clientUid, input: { rating: stars, comment: "" } });
    ids.push(created.id);
  }
  const summary = await service.listProviderRatings({ providerUid });
  assert.equal(summary.count, 3);
  assert.equal(summary.average, 3.67);
  const profile = db.read("providerProfiles", providerUid);
  assert.equal(profile.ratingCount, 3);
  assert.ok(Math.abs(profile.ratingAverage - 11 / 3) < 1e-9);
  assert.equal((await service.getRequestRating({ requestId: ids[0], clientUid })).rating, 5);
});

/* ---------- ISSUE 26: notificaciones, recordatorios y soporte ---------- */

function documentsUnder(db, prefix) {
  return [...db.documents.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, data]) => ({ key, ...data }));
}

test("ISSUE 26: cada cambio de estado notifica a la otra persona", async () => {
  const { db, service } = seedService();
  const created = await create(service);
  await move(service, created.id, "accept");
  await move(service, created.id, "confirm", "Cliente");
  const notifications = documentsUnder(db, "notifications/");
  assert.equal(notifications.length, 2);
  assert.deepEqual(
    notifications.map((item) => [item.recipientUid, item.toStatus, item.readAt]),
    [[clientUid, "Aceptada", null], [providerUid, "Confirmada", null]],
  );
});

test("ISSUE 26: crea recordatorios 24 h antes y los cancela al rechazar", async () => {
  const { db, service } = seedService();
  const created = await create(service);
  const reminders = documentsUnder(db, `solicitudes/${created.id}/reminders/`);
  assert.equal(reminders.length, 2);
  for (const reminder of reminders) {
    assert.equal(reminder.status, "pending");
    assert.equal(new Date(reminder.scheduledAt) - new Date(reminder.deliverAt), 24 * 60 * 60 * 1000);
  }
  await move(service, created.id, "reject");
  assert.ok(documentsUnder(db, `solicitudes/${created.id}/reminders/`).every((item) => item.status === "cancelled"));
});

test("ISSUE 26: cada usuario solo ve y marca sus propias notificaciones", async () => {
  const { db, service } = seedService();
  const created = await create(service);
  await move(service, created.id, "accept");
  const support = createSupportService({ db, now });
  const mine = await support.listNotifications({ uid: clientUid });
  assert.equal(mine.length, 1);
  assert.equal((await support.listNotifications({ uid: providerUid })).length, 0);
  await assert.rejects(
    support.markNotificationRead({ uid: providerUid, notificationId: mine[0].id }),
    (error) => error.statusCode === 404,
  );
  const read = await support.markNotificationRead({ uid: clientUid, notificationId: mine[0].id });
  assert.ok(read.readAt);
});

test("ISSUE 26: guarda mensajes de soporte válidos y rechaza los inválidos", async () => {
  const db = new MemoryFirestore();
  const support = createSupportService({ db, now });
  const saved = await support.createSupportMessage({
    uid: clientUid,
    role: "Cliente",
    input: { subject: "No veo mi solicitud", message: "Envié una solicitud ayer y no aparece en mi historial." },
  });
  assert.equal(saved.status, "open");
  assert.equal(db.read("supportMessages", saved.id).uid, clientUid);
  for (const input of [{ subject: "Hi", message: "Mensaje suficientemente largo." }, { subject: "Asunto válido", message: "corto" }, null]) {
    await assert.rejects(support.createSupportMessage({ uid: clientUid, role: "Cliente", input }), (error) => error.statusCode === 400);
  }
  await assert.rejects(
    support.createSupportMessage({ uid: clientUid, role: "Admin", input: { subject: "Asunto válido", message: "Mensaje suficientemente largo." } }),
    (error) => error.statusCode === 403,
  );
  assert.ok(support.listFaqs().length >= 3);
});
