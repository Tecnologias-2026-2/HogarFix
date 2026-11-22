import assert from "node:assert/strict";
import test from "node:test";
import { createRequestService } from "../src/services/request-service.js";

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

function eventsFor(db, requestId) {
  return [...db.documents.entries()]
    .filter(([key]) => key.startsWith(`solicitudes/${requestId}/events/`))
    .map(([, event]) => event);
}

test("creates server-owned request fields and an atomic creation event", async () => {
  const { db, service } = seedService();
  const result = await create(service);

  assert.equal(result.status, "Pendiente");
  assert.equal(result.clientUid, clientUid);
  assert.equal(result.providerUid, providerUid);
  assert.equal(result.categorySnapshot.priceCOP, 35000);
  assert.equal(result.timeZone, "America/Bogota");
  assert.equal(result.scheduledAt.toISOString(), "2026-11-25T15:00:00.000Z");
  assert.equal(db.read("solicitudes", result.id).status, "Pendiente");
  const events = [...db.documents.entries()].filter(([key]) =>
    key.startsWith(`solicitudes/${result.id}/events/`),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0][1].type, "created");
  assert.equal(events[0][1].actorUid, clientUid);
});

test("rejects an absent or inactive catalog association", async () => {
  for (const options of [{ catalogActive: false }, {}]) {
    const { db, service } = seedService(options);
    if (!Object.prototype.hasOwnProperty.call(options, "catalogActive")) {
      db.documents.delete(`providerCatalog/${input.providerCatalogId}`);
    }
    await assert.rejects(
      create(service),
      (error) => error.statusCode === 404 && error.code === "PROVIDER_NOT_FOUND",
    );
  }
});

test("rejects absent or inactive categories", async () => {
  for (const options of [{ categoryActive: false }, {}]) {
    const { db, service } = seedService(options);
    if (!Object.prototype.hasOwnProperty.call(options, "categoryActive")) {
      db.documents.delete(`categories/${input.categoryId}`);
    }
    await assert.rejects(
      create(service),
      (error) => error.statusCode === 404 && error.code === "CATEGORY_NOT_FOUND",
    );
  }
});

test("rejects incomplete, automatically pending, or unapproved provider profiles", async () => {
  const ineligibleProfiles = [
    { ...completeProfile, bio: "Perfil incompleto" },
    { ...completeProfile, automaticValidation: { status: "pending" } },
    { ...completeProfile, adminApproval: { status: "pending" } },
  ];

  for (const profile of ineligibleProfiles) {
    const { service } = seedService({ profile });
    await assert.rejects(
      create(service),
      (error) => error.statusCode === 409 && error.code === "PROVIDER_NOT_ELIGIBLE",
    );
  }
});

test("idempotency is scoped to the client and payload", async () => {
  const { db, service } = seedService();
  const original = await create(service);
  const replay = await create(service);

  assert.equal(replay.id, original.id);
  const requests = [...db.documents.keys()].filter(
    (key) => key.startsWith("solicitudes/") && !key.includes("/events/") && !key.includes("/reminders/"),
  );
  assert.equal(requests.length, 1);

  await assert.rejects(
    create(service, { input: { ...input, detail: "Un contenido diferente y válido." } }),
    (error) => error.statusCode === 409 && error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("lists and gets only requests belonging to the authenticated UID", async () => {
  const { db, service } = seedService();
  const own = await create(service);
  db.seed("solicitudes", "other-request", {
    clientUid: "another-client",
    providerUid: "another-provider",
    createdAt: new Date("2026-11-19T15:00:00.000Z"),
  });

  const clientList = await service.listRequests({ actorUid: clientUid, actorRole: "Cliente" });
  const providerList = await service.listRequests({ actorUid: providerUid, actorRole: "Proveedor" });
  assert.deepEqual(clientList.map(({ id }) => id), [own.id]);
  assert.deepEqual(providerList.map(({ id }) => id), [own.id]);

  await assert.rejects(
    service.getRequest({
      requestId: own.id,
      actorUid: "another-client",
      actorRole: "Cliente",
    }),
    (error) => error.statusCode === 404 && error.code === "REQUEST_NOT_FOUND",
  );
});

test("enforces role-specific transitions and writes an audit event", async () => {
  const { db, service } = seedService();
  const created = await create(service);

  await assert.rejects(
    service.transitionRequest({
      requestId: created.id,
      actorUid: clientUid,
      actorRole: "Cliente",
      action: "accept",
    }),
    (error) => error.statusCode === 403,
  );

  const accepted = await service.transitionRequest({
    requestId: created.id,
    actorUid: providerUid,
    actorRole: "Proveedor",
    action: "accept",
  });
  assert.equal(accepted.status, "Aceptada");

  const cancelled = await service.transitionRequest({
    requestId: created.id,
    actorUid: clientUid,
    actorRole: "Cliente",
    action: "cancel",
  });
  assert.equal(cancelled.status, "Cancelada");
  const events = eventsFor(db, created.id);
  assert.equal(events.length, 3);
  assert.equal(events[2].fromStatus, "Aceptada");
  assert.equal(events[2].toStatus, "Cancelada");
});

test("provider can reject a pending request", async () => {
  const { db, service } = seedService();
  const created = await create(service);

  const rejected = await service.transitionRequest({
    requestId: created.id,
    actorUid: providerUid,
    actorRole: "Proveedor",
    action: "reject",
  });

  assert.equal(rejected.status, "Rechazada");
  assert.equal(db.read("solicitudes", created.id).status, "Rechazada");
  assert.deepEqual(
    eventsFor(db, created.id).map(({ fromStatus, toStatus }) => [fromStatus, toStatus]),
    [[null, "Pendiente"], ["Pendiente", "Rechazada"]],
  );
});

test("client can confirm an accepted request", async () => {
  const { db, service } = seedService();
  const created = await create(service);
  await service.transitionRequest({
    requestId: created.id,
    actorUid: providerUid,
    actorRole: "Proveedor",
    action: "accept",
  });

  const confirmed = await service.transitionRequest({
    requestId: created.id,
    actorUid: clientUid,
    actorRole: "Cliente",
    action: "confirm",
  });

  assert.equal(confirmed.status, "Confirmada");
  assert.equal(db.read("solicitudes", created.id).status, "Confirmada");
  assert.deepEqual(eventsFor(db, created.id).slice(-1).map(({ fromStatus, toStatus }) => [
    fromStatus,
    toStatus,
  ]), [["Aceptada", "Confirmada"]]);
});

test("provider can start a confirmed request", async () => {
  const { db, service } = seedService();
  const created = await create(service);
  await service.transitionRequest({
    requestId: created.id,
    actorUid: providerUid,
    actorRole: "Proveedor",
    action: "accept",
  });
  await service.transitionRequest({
    requestId: created.id,
    actorUid: clientUid,
    actorRole: "Cliente",
    action: "confirm",
  });

  const started = await service.transitionRequest({
    requestId: created.id,
    actorUid: providerUid,
    actorRole: "Proveedor",
    action: "start",
  });

  assert.equal(started.status, "En proceso");
  assert.equal(db.read("solicitudes", created.id).status, "En proceso");
  assert.deepEqual(eventsFor(db, created.id).slice(-1).map(({ fromStatus, toStatus }) => [
    fromStatus,
    toStatus,
  ]), [["Confirmada", "En proceso"]]);
});

test("provider can complete a request in progress", async () => {
  const { db, service } = seedService();
  const created = await create(service);
  await service.transitionRequest({
    requestId: created.id,
    actorUid: providerUid,
    actorRole: "Proveedor",
    action: "accept",
  });
  await service.transitionRequest({
    requestId: created.id,
    actorUid: clientUid,
    actorRole: "Cliente",
    action: "confirm",
  });
  await service.transitionRequest({
    requestId: created.id,
    actorUid: providerUid,
    actorRole: "Proveedor",
    action: "start",
  });

  const completed = await service.transitionRequest({
    requestId: created.id,
    actorUid: providerUid,
    actorRole: "Proveedor",
    action: "complete",
  });

  assert.equal(completed.status, "Completada");
  assert.equal(db.read("solicitudes", created.id).status, "Completada");
  assert.deepEqual(eventsFor(db, created.id).slice(-1).map(({ fromStatus, toStatus }) => [
    fromStatus,
    toStatus,
  ]), [["En proceso", "Completada"]]);
});

test("clients and providers cannot transition requests owned by someone else", async () => {
  const { db, service } = seedService();
  db.seed("solicitudes", "other-client-request", {
    clientUid: "another-client",
    providerUid,
    status: "Pendiente",
  });
  db.seed("solicitudes", "other-provider-request", {
    clientUid,
    providerUid: "another-provider",
    status: "Pendiente",
  });

  await assert.rejects(
    service.transitionRequest({
      requestId: "other-client-request",
      actorUid: clientUid,
      actorRole: "Cliente",
      action: "cancel",
    }),
    (error) => error.statusCode === 404 && error.code === "REQUEST_NOT_FOUND",
  );
  await assert.rejects(
    service.transitionRequest({
      requestId: "other-provider-request",
      actorUid: providerUid,
      actorRole: "Proveedor",
      action: "reject",
    }),
    (error) => error.statusCode === 404 && error.code === "REQUEST_NOT_FOUND",
  );

  assert.equal(db.read("solicitudes", "other-client-request").status, "Pendiente");
  assert.equal(db.read("solicitudes", "other-provider-request").status, "Pendiente");
  assert.deepEqual(eventsFor(db, "other-client-request"), []);
  assert.deepEqual(eventsFor(db, "other-provider-request"), []);
});

test("rejects invalid state transitions without an audit write", async () => {
  const { db, service } = seedService();
  const created = await create(service);

  for (const [actorUid, actorRole, action] of [
    [clientUid, "Cliente", "confirm"],
    [providerUid, "Proveedor", "start"],
    [providerUid, "Proveedor", "complete"],
  ]) {
    await assert.rejects(
      service.transitionRequest({
        requestId: created.id,
        actorUid,
        actorRole,
        action,
      }),
      (error) => error.statusCode === 409 && error.code === "INVALID_REQUEST_TRANSITION",
    );
    assert.equal(db.read("solicitudes", created.id).status, "Pendiente");
    assert.equal(eventsFor(db, created.id).length, 1);
  }
});

test("maps Firestore failures to explicit service errors", async () => {
  const { db, service } = seedService();
  db.failure = "get";

  await assert.rejects(
    create(service),
    (error) => error.statusCode === 503 && error.code === "FIRESTORE_UNAVAILABLE",
  );
});

test("a failed state transaction leaves the request and its events unchanged", async () => {
  const { db, service } = seedService();
  const created = await create(service);
  const eventCount = eventsFor(db, created.id).length;
  db.failure = "transactionCommit";

  await assert.rejects(
    service.transitionRequest({
      requestId: created.id,
      actorUid: clientUid,
      actorRole: "Cliente",
      action: "cancel",
    }),
    (error) => error.statusCode === 503 && error.code === "FIRESTORE_UNAVAILABLE",
  );
  assert.equal(db.read("solicitudes", created.id).status, "Pendiente");
  assert.equal(
    eventsFor(db, created.id).length,
    eventCount,
  );
});
