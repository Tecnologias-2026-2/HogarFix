import { createHash, randomUUID } from "node:crypto";
import { Firestore } from "@google-cloud/firestore";
import { createProfileService } from "../../src/services/profile-service.js";
import { createRequestService } from "../../src/services/request-service.js";
import { validateEnvironment } from "../../scripts/run-emulator-tests.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const CATEGORY_IDS = ["plomeria", "electricidad", "jardineria", "aseo-general"];

function scheduledDate(now) {
  const date = new Date(now.getTime() + 5 * DAY_MS);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hashIdempotencyKey(clientUid, key) {
  return createHash("sha256").update(`${clientUid}\0${key}`).digest("hex");
}

export async function createRequestFixture({
  catalogActive = true,
  categoryActive = true,
  providerDisabled = false,
} = {}) {
  const { baseUrl, projectId } = validateEnvironment();
  const emulator = new URL(baseUrl);
  const db = new Firestore({
    projectId,
    host: emulator.host,
    ssl: false,
    // The local emulator accepts unauthenticated calls; do not invoke ADC.
    auth: {
      async getClient() {
        return {
          async getRequestHeaders() {
            return new Map();
          },
        };
      },
      async getProjectId() {
        return projectId;
      },
      async getUniverseDomain() {
        return "googleapis.com";
      },
    },
  });
  const runId = randomUUID();
  const clientUid = `it-client-${runId}`;
  const providerUid = `it-provider-${runId}`;
  const providerCatalogId = `it-catalog-${runId}`;
  let categoryId;
  let categoryCreated = false;
  let createdCategoryReference;
  const fixedNow = new Date();
  let timeOffset = 0;
  let isProviderDisabled = providerDisabled;
  let cleaned = false;
  const cleanupReferences = new Map();
  const reservedIdempotencyPaths = new Set();

  const now = () => new Date(fixedNow.getTime() + timeOffset++ * 1000);
  const trackCreated = (reference) => {
    cleanupReferences.set(reference.path, reference);
    return reference;
  };
  const createFixtureDocument = async (reference, data) => {
    try {
      await reference.create({ ...data, fixtureRunId: runId });
    } catch (error) {
      const snapshot = await reference.get();
      if (!snapshot.exists || snapshot.get("fixtureRunId") !== runId) throw error;
    }
    return trackCreated(reference);
  };
  const userRef = (uid) => db.collection("users").doc(uid);
  const profileRef = (uid) => db.collection("providerProfiles").doc(uid);
  const catalogRef = (id = providerCatalogId) => db.collection("providerCatalog").doc(id);
  const categoryRef = (id = categoryId) => db.collection("categories").doc(id);
  const requestRef = (id) => db.collection("solicitudes").doc(id);
  const idempotencyRef = (key) =>
    db.collection("requestIdempotency").doc(hashIdempotencyKey(clientUid, key));

  async function cleanup() {
    if (cleaned) return;
    cleaned = true;
    const cleanupErrors = [];

    if (categoryCreated) trackCreated(createdCategoryReference);

    const deletionResults = await Promise.allSettled(
      [...cleanupReferences.values()].map((reference) => db.recursiveDelete(reference)),
    );
    for (const result of deletionResults) {
      if (result.status === "rejected") cleanupErrors.push(result.reason);
    }

    try {
      await db.terminate();
    } catch (error) {
      cleanupErrors.push(error);
    }

    if (cleanupErrors.length) {
      throw new AggregateError(cleanupErrors, "No se pudieron limpiar todos los datos de integración.");
    }
  }

  try {
    const categoryData = {
      active: categoryActive,
      name: "Categoría temporal de integración",
      fixedPriceCOP: 35000,
      durationMinutes: 60,
      fixtureRunId: runId,
    };
    for (const candidateId of CATEGORY_IDS) {
      const reference = categoryRef(candidateId);
      if ((await reference.get()).exists) continue;
      try {
        await reference.create(categoryData);
        categoryId = candidateId;
        categoryCreated = true;
        createdCategoryReference = reference;
        break;
      } catch (error) {
        const snapshot = await reference.get();
        if (!snapshot.exists) throw error;
        if (snapshot.get("fixtureRunId") === runId) {
          categoryId = candidateId;
          categoryCreated = true;
          createdCategoryReference = reference;
          break;
        }
      }
    }
    if (!categoryCreated) {
      throw new Error("No hay una categoría admitida disponible para crear datos temporales.");
    }

    const profileService = createProfileService({
      db,
      now,
      auth: {
        async getUser(uid) {
          if (uid !== providerUid) {
            throw Object.assign(new Error("No existe la cuenta Auth temporal."), {
              code: "auth/user-not-found",
            });
          }
          return { uid, disabled: isProviderDisabled };
        },
      },
    });
    const service = createRequestService({ db, profileService, now });
    const input = {
      providerCatalogId,
      categoryId,
      date: scheduledDate(fixedNow),
      time: "10:00",
      address: "Calle de prueba 123",
      detail: "Solicitud temporal para prueba de integración.",
    };

    const seedResults = await Promise.allSettled([
      createFixtureDocument(userRef(clientUid), {
        email: `${clientUid}@integration.test`,
        firstName: "Cliente",
        lastName: "Temporal",
        role: "Cliente",
      }),
      createFixtureDocument(userRef(providerUid), {
        email: `${providerUid}@integration.test`,
        firstName: "Proveedor",
        lastName: "Temporal",
        role: "Proveedor",
      }),
      createFixtureDocument(profileRef(providerUid), {
        bio: "Profesional temporal para pruebas de integración de solicitudes.",
        experienceYears: 5,
        coverageZone: "Bogotá",
        availability: "Lunes a sábado",
        services: [categoryId],
        automaticValidation: { status: "passed" },
        adminApproval: { status: "approved" },
      }),
      createFixtureDocument(catalogRef(), { providerUid, active: catalogActive }),
    ]);
    const seedErrors = seedResults
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);
    if (seedErrors.length) {
      throw new AggregateError(seedErrors, "No se pudieron crear todos los datos temporales.");
    }

    return {
      db,
      service,
      clientUid,
      providerUid,
      providerCatalogId,
      categoryId,
      input,
      now,
      cleanup,
      newId(prefix) {
        return `it-${prefix}-${randomUUID()}`;
      },
      async createRequest({ input: inputOverrides = {}, idempotencyKey = this.newId("key") } = {}) {
        const keyReference = idempotencyRef(idempotencyKey);
        if (
          !cleanupReferences.has(keyReference.path)
          && !reservedIdempotencyPaths.has(keyReference.path)
        ) {
          const existingKey = await keyReference.get();
          if (
            existingKey.exists
            && !cleanupReferences.has(keyReference.path)
            && !reservedIdempotencyPaths.has(keyReference.path)
          ) {
            throw new Error("La clave temporal de idempotencia ya existe en Firestore.");
          }
          reservedIdempotencyPaths.add(keyReference.path);
        }
        const result = await service.createRequest({
          clientUid,
          input: { ...input, ...inputOverrides },
          idempotencyKey,
        });
        const createdRequestReference = requestRef(result.id);
        const storedRequest = await createdRequestReference.get();
        if (storedRequest.exists && storedRequest.get("clientUid") === clientUid) {
          trackCreated(createdRequestReference);
        }
        const storedIdempotency = await keyReference.get();
        if (storedIdempotency.exists && storedIdempotency.get("requestId") === result.id) {
          trackCreated(keyReference);
        }
        if (
          !storedRequest.exists
          || storedRequest.get("clientUid") !== clientUid
          || !storedIdempotency.exists
          || storedIdempotency.get("requestId") !== result.id
        ) {
          throw new Error("La solicitud temporal no coincide con los documentos creados.");
        }
        return result;
      },
      async seedCatalog(id, targetProviderUid, active = true) {
        await createFixtureDocument(catalogRef(id), { providerUid: targetProviderUid, active });
      },
      async setCatalogActive(active) {
        await catalogRef().update({ active });
      },
      async setCategoryActive(active) {
        await categoryRef().update({ active });
      },
      setProviderDisabled(disabled) {
        isProviderDisabled = disabled;
      },
      async seedForeignRequest(data) {
        const reference = db.collection("solicitudes").doc();
        await createFixtureDocument(reference, { createdAt: now(), ...data });
        return reference.id;
      },
      async eventsFor(requestId) {
        const snapshot = await db
          .collection("solicitudes")
          .doc(requestId)
          .collection("events")
          .orderBy("createdAt", "asc")
          .get();
        return snapshot.docs.map((document) => document.data());
      },
      idempotencyRef,
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Falló la creación de fixtures y también su limpieza.",
      );
    }
    throw error;
  }
}
