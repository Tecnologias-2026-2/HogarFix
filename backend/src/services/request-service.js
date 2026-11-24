import { createHash } from "node:crypto";
import { getAdminAuth, getAdminFirestore } from "../config/firebase-admin.js";
import { inspectProviderProfile } from "./profile-validation.js";
import { createProfileService } from "./profile-service.js";
import {
  createRequestError,
  REQUEST_STATUSES,
  validateCreateRequest,
  validateCreateRating,
  validateIdempotencyKey,
} from "./request-validation.js";

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const SAFE_CLIENT_ERROR_CODES = new Set([
  "INVALID_UID", "INVALID_LIMIT", "INVALID_REQUEST_ID", "FORBIDDEN",
  "CATEGORY_NOT_FOUND", "PROVIDER_NOT_FOUND", "PROVIDER_NOT_ELIGIBLE",
  "PROVIDER_SCHEDULE_CONFLICT", "PROVIDER_LINK_CHANGED", "CATEGORY_CHANGED",
  "INVALID_REQUEST_TRANSITION", "REQUEST_NOT_FOUND", "REQUEST_NOT_COMPLETED",
  "RATING_ALREADY_EXISTS", "INVALID_RATING", "INVALID_RATING_COMMENT",
  "PROTECTED_RATING_FIELDS", "IDEMPOTENCY_CONFLICT", "INVALID_IDEMPOTENCY_KEY",
  "CATEGORY_INVALID", "IDEMPOTENCY_INVALID",
]);

const TRANSITIONS = Object.freeze({
  accept: { role: "Proveedor", from: ["Pendiente"], to: "Aceptada", timestamp: "acceptedAt" },
  reject: { role: "Proveedor", from: ["Pendiente"], to: "Rechazada", timestamp: "rejectedAt" },
  confirm: { role: "Cliente", from: ["Aceptada"], to: "Confirmada", timestamp: "confirmedAt" },
  cancel: {
    role: "Cliente",
    from: ["Pendiente", "Aceptada"],
    to: "Cancelada",
    timestamp: "cancelledAt",
  },
  start: { role: "Proveedor", from: ["Confirmada"], to: "En proceso", timestamp: "startedAt" },
  complete: { role: "Proveedor", from: ["En proceso"], to: "Completada", timestamp: "completedAt" },
});

function serviceError(message, statusCode, code) {
  return createRequestError(message, statusCode, code);
}

function requireUid(uid) {
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/")) {
    throw serviceError("El usuario autenticado no es válido.", 400, "INVALID_UID");
  }
}

function safeFirestoreError(error) {
  if (
    Number.isInteger(error?.statusCode)
    && error.statusCode >= 400
    && error.statusCode < 500
    && SAFE_CLIENT_ERROR_CODES.has(error.code)
  ) return error;
  if (error?.code === "CATEGORY_INVALID" || error?.code === "IDEMPOTENCY_INVALID") {
    return serviceError(
      error.code === "CATEGORY_INVALID" ? "La categoría indicada no es válida." : "La clave de idempotencia no es válida.",
      400,
      error.code,
    );
  }
  if (Number.isInteger(error?.statusCode) && error.statusCode >= 500) return error;
  console.error("Firestore request operation failed:", error?.code || "unknown");
  return serviceError(
    "No se pudo completar la operación de solicitudes.",
    503,
    "FIRESTORE_UNAVAILABLE",
  );
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function payloadHash(input) {
  return hash(
    JSON.stringify({
      providerCatalogId: input.providerCatalogId,
      categoryId: input.categoryId,
      date: input.date,
      time: input.time,
      address: input.address,
      detail: input.detail,
    }),
  );
}

function documentData(snapshot) {
  return snapshot.exists ? snapshot.data() : null;
}

function toRequest(snapshot, data) {
  return { id: snapshot.id, ...data };
}

function validateCategory(data, categoryId) {
  if (!data || data.active !== true) {
    throw serviceError("La categoría no existe o no está activa.", 404, "CATEGORY_NOT_FOUND");
  }
  if (
    typeof data.name !== "string"
    || !data.name.trim()
    || !Number.isInteger(data.fixedPriceCOP)
    || data.fixedPriceCOP <= 0
    || !Number.isInteger(data.durationMinutes)
    || data.durationMinutes <= 0
    || data.durationMinutes > 24 * 60
  ) {
    throw serviceError("La configuración de la categoría no es válida.", 503, "CATEGORY_INVALID");
  }
  return {
    id: categoryId,
    name: data.name.trim(),
    fixedPriceCOP: data.fixedPriceCOP,
    durationMinutes: data.durationMinutes,
  };
}

function validateCatalogLink(data) {
  if (!data || data.active !== true) {
    throw serviceError("El proveedor no está disponible en el catálogo.", 404, "PROVIDER_NOT_FOUND");
  }
  if (
    typeof data.providerUid !== "string"
    || !data.providerUid
    || data.providerUid.length > 128
    || data.providerUid.includes("/")
  ) {
    throw serviceError("La asociación del proveedor no es válida.", 404, "PROVIDER_NOT_FOUND");
  }
  return data.providerUid;
}

function validateProviderProfile(userData, profileData, categoryId) {
  if (!userData || userData.role !== "Proveedor") {
    throw serviceError("El proveedor no está habilitado para ofrecer servicios.", 409, "PROVIDER_NOT_ELIGIBLE");
  }
  const assessment = inspectProviderProfile(profileData || {});
  if (
    !assessment.complete
    || profileData?.automaticValidation?.status !== "passed"
    || profileData?.adminApproval?.status !== "approved"
    || !Array.isArray(profileData?.services)
    || !profileData.services.includes(categoryId)
  ) {
    throw serviceError("El proveedor no está habilitado para esta categoría.", 409, "PROVIDER_NOT_ELIGIBLE");
  }
}


const BUSY_REQUEST_STATUSES = new Set([
  "Aceptada",
  "Confirmada",
  "En proceso",
]);


function scheduleTime(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return NaN;
}

function schedulesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  const startA = scheduleTime(firstStart);
  const endA = scheduleTime(firstEnd);
  const startB = scheduleTime(secondStart);
  const endB = scheduleTime(secondEnd);

  if (
    [startA, endA, startB, endB].some((value) => !Number.isFinite(value))
    || startA >= endA
    || startB >= endB
  ) {
    throw serviceError(
      "No se pudo validar el horario de la solicitud.",
      409,
      "INVALID_REQUEST_SCHEDULE",
    );
  }

  return startA < endB && endA > startB;
}


function validateListLimit(value) {
  if (value === undefined) return DEFAULT_LIST_LIMIT;
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIST_LIMIT) {
    throw serviceError(`El límite debe ser un entero entre 1 y ${MAX_LIST_LIMIT}.`, 400, "INVALID_LIMIT");
  }
  return value;
}

function validateRequestId(requestId) {
  if (
    typeof requestId !== "string"
    || !requestId
    || requestId.length > 128
    || requestId.includes("/")
  ) {
    throw serviceError("La solicitud indicada no es válida.", 400, "INVALID_REQUEST_ID");
  }
}

function assertActorRole(actorRole) {
  if (!["Cliente", "Proveedor"].includes(actorRole)) {
    throw serviceError("El usuario no tiene permiso para esta operación.", 403, "FORBIDDEN");
  }
}

export function createRequestService({
  db,
  auth,
  profileService,
  now = () => new Date(),
} = {}) {
  const firestore = () => db || getAdminFirestore();
  const firebaseAuth = () => auth || getAdminAuth();
  const profiles = profileService || createProfileService({ db, auth, now });

  const collection = (name) => firestore().collection(name);
  const requestRef = (id) => collection("solicitudes").doc(id);
  const providerCatalogRef = (id) => collection("providerCatalog").doc(id);
  const categoryRef = (id) => collection("categories").doc(id);
  const userRef = (uid) => collection("users").doc(uid);
  const providerProfileRef = (uid) => collection("providerProfiles").doc(uid);
  const ratingRef = (requestId) => collection("ratings").doc(requestId);
  const providerScheduleRef = (uid) => collection("providerSchedules").doc(uid);

  async function getIdempotentRequest(reference, expectedPayloadHash, transaction) {
    const keySnapshot = await transaction.get(reference);
    if (!keySnapshot.exists) return null;
    const keyData = keySnapshot.data();
    if (keyData.payloadHash !== expectedPayloadHash) {
      throw serviceError(
        "La clave de idempotencia ya se utilizó con otros datos.",
        409,
        "IDEMPOTENCY_CONFLICT",
      );
    }
    if (typeof keyData.requestId !== "string" || !keyData.requestId) {
      throw serviceError("El registro de idempotencia no es válido.", 503, "IDEMPOTENCY_INVALID");
    }
    const existingRef = requestRef(keyData.requestId);
    const existingSnapshot = await transaction.get(existingRef);
    if (!existingSnapshot.exists) {
      throw serviceError("No se encontró la solicitud asociada a la clave.", 503, "IDEMPOTENCY_INVALID");
    }
    return toRequest(existingSnapshot, existingSnapshot.data());
  }

  async function checkProviderEligibility(uid) {
    let eligibility;
    try {
      eligibility = await profiles.getProviderEligibility(uid);
    } catch (error) {
      if (Number.isInteger(error?.statusCode)) throw error;
      throw safeFirestoreError(error);
    }
    if (!eligibility?.eligible) {
      throw serviceError("El proveedor no está habilitado para ofrecer servicios.", 409, "PROVIDER_NOT_ELIGIBLE");
    }
  }

  async function createRequest({ clientUid, input, idempotencyKey }) {
    requireUid(clientUid);
    const values = validateCreateRequest(input, { now: now() });
    const key = validateIdempotencyKey(idempotencyKey);
    const expectedHash = payloadHash(values);
    const scopedKey = hash(`${clientUid}\0${key}`);
    const idempotencyRef = collection("requestIdempotency").doc(scopedKey);

    try {
      const replay = await firestore().runTransaction((transaction) =>
        getIdempotentRequest(idempotencyRef, expectedHash, transaction),
      );
      if (replay) return replay;

      const catalogSnapshot = await providerCatalogRef(values.providerCatalogId).get();
      const providerUid = validateCatalogLink(documentData(catalogSnapshot));
      const categorySnapshot = await categoryRef(values.categoryId).get();
      const category = validateCategory(documentData(categorySnapshot), values.categoryId);
      await checkProviderEligibility(providerUid);

      const solicitudRef = collection("solicitudes").doc();
      const timestamp = now();
      const scheduleEnd = new Date(
        values.scheduledAt.getTime() + category.durationMinutes * 60 * 1000,
      );
      let result;

      await firestore().runTransaction(async (transaction) => {
        const replayInTransaction = await getIdempotentRequest(
          idempotencyRef,
          expectedHash,
          transaction,
        );
        if (replayInTransaction) {
          result = replayInTransaction;
          return;
        }

        const currentCatalog = await transaction.get(providerCatalogRef(values.providerCatalogId));
        const currentCategory = await transaction.get(categoryRef(values.categoryId));
        const clientSnapshot = await transaction.get(userRef(clientUid));
        const providerUserSnapshot = await transaction.get(userRef(providerUid));
        const providerProfileSnapshot = await transaction.get(providerProfileRef(providerUid));

        const currentProviderUid = validateCatalogLink(documentData(currentCatalog));
        if (currentProviderUid !== providerUid) {
          throw serviceError("La asociación del proveedor cambió. Inténtalo de nuevo.", 409, "PROVIDER_LINK_CHANGED");
        }
        const currentCategoryData = validateCategory(
          documentData(currentCategory),
          values.categoryId,
        );
        if (
          currentCategoryData.fixedPriceCOP !== category.fixedPriceCOP
          || currentCategoryData.durationMinutes !== category.durationMinutes
          || currentCategoryData.name !== category.name
        ) {
          throw serviceError("La categoría cambió. Inténtalo de nuevo.", 409, "CATEGORY_CHANGED");
        }

        const clientData = documentData(clientSnapshot);
        if (!clientData || clientData.role !== "Cliente") {
          throw serviceError("No se encontró un perfil de cliente válido.", 403, "FORBIDDEN");
        }
        const providerUser = documentData(providerUserSnapshot);
        const providerProfile = documentData(providerProfileSnapshot);
        validateProviderProfile(providerUser, providerProfile, values.categoryId);

        const providerName = [providerUser.firstName, providerUser.lastName]
          .filter((part) => typeof part === "string" && part.trim())
          .map((part) => part.trim())
          .join(" ");
        const clientName = [clientData.firstName, clientData.lastName]
          .filter((part) => typeof part === "string" && part.trim())
          .map((part) => part.trim())
          .join(" ");
        const requestData = {
          schemaVersion: 1,
          clientUid,
          providerCatalogId: values.providerCatalogId,
          providerUid,
          categoryId: values.categoryId,
          categorySnapshot: {
            name: category.name,
            priceCOP: category.fixedPriceCOP,
            durationMinutes: category.durationMinutes,
          },
          providerSnapshot: { displayName: providerName },
          clientDisplayName: clientName,
          date: values.date,
          time: values.time,
          scheduledAt: values.scheduledAt,
          scheduledEndAt: scheduleEnd,
          timeZone: values.timeZone,
          address: values.address,
          detail: values.detail,
          status: "Pendiente",
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        transaction.set(solicitudRef, requestData);
        transaction.set(idempotencyRef, {
          requestId: solicitudRef.id,
          payloadHash: expectedHash,
          createdAt: timestamp,
        });
        transaction.set(solicitudRef.collection("events").doc(), {
          type: "created",
          actorUid: clientUid,
          actorRole: "Cliente",
          fromStatus: null,
          toStatus: "Pendiente",
          createdAt: timestamp,
        });
        const remindAt = new Date(values.scheduledAt.getTime() - 24 * 60 * 60 * 1000);
        for (const [recipientUid, recipientRole] of [[clientUid, "Cliente"], [providerUid, "Proveedor"]]) {
          transaction.set(solicitudRef.collection("reminders").doc(recipientRole.toLowerCase()), {
            requestId: solicitudRef.id,
            recipientUid,
            recipientRole,
            scheduledAt: values.scheduledAt,
            deliverAt: remindAt,
            status: "pending",
            createdAt: timestamp,
          });
        }
        result = { id: solicitudRef.id, ...requestData };
      });

      return result;
    } catch (error) {
      throw safeFirestoreError(error);
    }
  }

  async function listRequests({ actorUid, actorRole, limit } = {}) {
    requireUid(actorUid);
    assertActorRole(actorRole);
    const resultLimit = validateListLimit(limit);
    const ownerField = actorRole === "Cliente" ? "clientUid" : "providerUid";
    try {
      const snapshot = await collection("solicitudes")
        .where(ownerField, "==", actorUid)
        .orderBy("createdAt", "desc")
        .limit(resultLimit)
        .get();
      return snapshot.docs.map((document) => toRequest(document, document.data()));
    } catch (error) {
      throw safeFirestoreError(error);
    }
  }

  async function getRequest({ requestId, actorUid, actorRole } = {}) {
    validateRequestId(requestId);
    requireUid(actorUid);
    assertActorRole(actorRole);
    try {
      const snapshot = await requestRef(requestId).get();
      const data = documentData(snapshot);
      if (!data) throw serviceError("No encontramos esa solicitud.", 404, "REQUEST_NOT_FOUND");
      const ownerField = actorRole === "Cliente" ? "clientUid" : "providerUid";
      if (data[ownerField] !== actorUid) {
        throw serviceError("No encontramos esa solicitud.", 404, "REQUEST_NOT_FOUND");
      }
      return toRequest(snapshot, data);
    } catch (error) {
      throw safeFirestoreError(error);
    }
  }

async function checkProviderSchedule(transaction, providerUid, requestId, requestData) {
  const snapshot = await transaction.get(
    collection("solicitudes").where("providerUid", "==", providerUid),
  );

  for (const document of snapshot.docs) {
    if (document.id === requestId) continue;

    const existing = document.data();

    if (!BUSY_REQUEST_STATUSES.has(existing.status)) continue;

    if (
      schedulesOverlap(
        requestData.scheduledAt,
        requestData.scheduledEndAt,
        existing.scheduledAt,
        existing.scheduledEndAt,
      )
    ) {
      throw serviceError(
        "El proveedor ya tiene un servicio asignado en ese horario.",
        409,
        "PROVIDER_SCHEDULE_CONFLICT",
      );
    }
  }
}



  async function checkAcceptanceEligibility(requestId, actorUid) {
    const snapshot = await requestRef(requestId).get();
    const data = documentData(snapshot);
    if (!data || data.providerUid !== actorUid) {
      throw serviceError("No encontramos esa solicitud.", 404, "REQUEST_NOT_FOUND");
    }

    const [catalogSnapshot, categorySnapshot] = await Promise.all([
      providerCatalogRef(data.providerCatalogId).get(),
      categoryRef(data.categoryId).get(),
    ]);
    if (validateCatalogLink(documentData(catalogSnapshot)) !== actorUid) {
      throw serviceError("El proveedor no está habilitado para esta solicitud.", 409, "PROVIDER_NOT_ELIGIBLE");
    }
    validateCategory(documentData(categorySnapshot), data.categoryId);
    await checkProviderEligibility(actorUid);
  }

  async function transitionRequest({ requestId, actorUid, actorRole, action } = {}) {
    validateRequestId(requestId);
    requireUid(actorUid);
    assertActorRole(actorRole);
    const transition = TRANSITIONS[action];
    if (!transition || transition.role !== actorRole) {
      throw serviceError("La acción no está permitida para este rol.", 403, "FORBIDDEN");
    }

    const reference = requestRef(requestId);
    try {
      if (action === "accept") await checkAcceptanceEligibility(requestId, actorUid);

      let result;
      await firestore().runTransaction(async (transaction) => {
        let scheduleSnapshot
        const snapshot = await transaction.get(reference);
        const data = documentData(snapshot);
        if (!data) throw serviceError("No encontramos esa solicitud.", 404, "REQUEST_NOT_FOUND");
        const ownerField = actorRole === "Cliente" ? "clientUid" : "providerUid";
        if (data[ownerField] !== actorUid) {
          throw serviceError("No encontramos esa solicitud.", 404, "REQUEST_NOT_FOUND");
        }

        if (action === "accept") {
          const catalogSnapshot = await transaction.get(providerCatalogRef(data.providerCatalogId));
          const categorySnapshot = await transaction.get(categoryRef(data.categoryId));
          const providerUserSnapshot = await transaction.get(userRef(actorUid));
          const providerProfileSnapshot = await transaction.get(providerProfileRef(actorUid));

          const scheduleReference = providerScheduleRef(actorUid);
          scheduleSnapshot = await transaction.get(scheduleReference);

          await checkProviderSchedule(
            transaction,
            actorUid,
            requestId,
            data,
          );
          if (validateCatalogLink(documentData(catalogSnapshot)) !== actorUid) {
            throw serviceError("El proveedor no está habilitado para esta solicitud.", 409, "PROVIDER_NOT_ELIGIBLE");
          }
          validateCategory(documentData(categorySnapshot), data.categoryId);
          validateProviderProfile(
            documentData(providerUserSnapshot),
            documentData(providerProfileSnapshot),
            data.categoryId,
          );
        }

        if (!transition.from.includes(data.status)) {
          throw serviceError(
            "La solicitud no puede cambiar desde su estado actual.",
            409,
            "INVALID_REQUEST_TRANSITION",
          );
        }

        if (
          (action === "cancel" && BUSY_REQUEST_STATUSES.has(data.status))
          || action === "complete"
        ) {
          scheduleSnapshot = await transaction.get(
           providerScheduleRef(data.providerUid)
          );
        }

        const remindersReference = reference.collection("reminders");
        const reminderSnapshots = action === "cancel" || action === "reject" || action === "complete"
          ? await Promise.all(["cliente", "proveedor"].map((role) => transaction.get(remindersReference.doc(role))))
          : [];

        const timestamp = now();
        const eventRef = reference.collection("events").doc();
        transaction.update(reference, {
          status: transition.to,
          updatedAt: timestamp,
          [transition.timestamp]: timestamp,
        });
        const changesProviderSchedule =
          action === "accept"
          || (action === "cancel" && data.status === "Aceptada")
          || action === "complete";

        if (changesProviderSchedule) {
          transaction.set(
            providerScheduleRef(data.providerUid),
            {
              version: (scheduleSnapshot?.get("version") || 0) + 1,
              updatedAt: timestamp,
            },
            { merge: true },
          );
        }

        transaction.set(eventRef, {
          type: "status_changed",
          actorUid,
          actorRole,
          fromStatus: data.status,
          toStatus: transition.to,
          createdAt: timestamp,
        });
        for (let index = 0; index < reminderSnapshots.length; index += 1) {
          if (reminderSnapshots[index].exists && reminderSnapshots[index].get("status") === "pending") {
            transaction.update(reminderSnapshots[index].ref, { status: "cancelled", updatedAt: timestamp });
          }
        }
        const recipientUid = actorRole === "Cliente" ? data.providerUid : data.clientUid;
        if (typeof recipientUid === "string" && recipientUid) {
          const notificationRef = collection("notifications").doc();
          transaction.set(notificationRef, {
            recipientUid,
            type: "request_status_changed",
            requestId,
            fromStatus: data.status,
            toStatus: transition.to,
            actorRole,
            readAt: null,
            createdAt: timestamp,
          });
        }
        result = {
          ...data,
          status: transition.to,
          updatedAt: timestamp,
          [transition.timestamp]: timestamp,
          id: snapshot.id,
        };
      });
      return result;
    } catch (error) {
      throw safeFirestoreError(error);
    }
  }

  async function createRating({ requestId, clientUid, input } = {}) {
    validateRequestId(requestId);
    requireUid(clientUid);
    const values = validateCreateRating(input);
    const reference = requestRef(requestId);
    const reviewReference = ratingRef(requestId);
    try {
      let result;
      await firestore().runTransaction(async (transaction) => {
        const requestSnapshot = await transaction.get(reference);
        const request = documentData(requestSnapshot);
        if (!request || request.clientUid !== clientUid) {
          throw serviceError("No encontramos esa solicitud.", 404, "REQUEST_NOT_FOUND");
        }
        if (request.status !== "Completada") {
          throw serviceError("Solo puedes calificar un servicio completado.", 409, "REQUEST_NOT_COMPLETED");
        }

        const existingReview = await transaction.get(reviewReference);
        if (existingReview.exists) {
          throw serviceError("Este servicio ya tiene una calificación.", 409, "RATING_ALREADY_EXISTS");
        }
        if (typeof request.providerUid !== "string" || !request.providerUid) {
          throw serviceError("No se encontró el proveedor de esta solicitud.", 409, "PROVIDER_NOT_FOUND");
        }

        const clientSnapshot = await transaction.get(userRef(clientUid));
        const profileReference = providerProfileRef(request.providerUid);
        const providerProfileSnapshot = await transaction.get(profileReference);
        const client = documentData(clientSnapshot) || {};
        const providerProfile = documentData(providerProfileSnapshot) || {};
        const previousCount = Number.isInteger(providerProfile.ratingCount)
          ? providerProfile.ratingCount
          : 0;
        const previousAverage = Number.isFinite(providerProfile.ratingAverage)
          ? providerProfile.ratingAverage
          : 0;
        const ratingCount = previousCount + 1;
        const ratingAverage = (previousAverage * previousCount + values.rating) / ratingCount;
        const createdAt = now();
        const clientDisplayName = [client.firstName, client.lastName]
          .filter((part) => typeof part === "string" && part.trim())
          .map((part) => part.trim())
          .join(" ") || "Cliente";
        const review = {
          serviceId: requestId,
          clientUid,
          clientDisplayName,
          providerUid: request.providerUid,
          rating: values.rating,
          comment: values.comment,
          createdAt,
        };
        transaction.create(reviewReference, review);
        transaction.set(profileReference, { ratingCount, ratingAverage }, { merge: true });
        result = { id: requestId, ...review };
      });
      return result;
    } catch (error) {
      throw safeFirestoreError(error);
    }
  }

  async function listProviderRatings({ providerUid } = {}) {
    requireUid(providerUid);
    try {
      const [profileSnapshot, ratingsSnapshot] = await Promise.all([
        providerProfileRef(providerUid).get(),
        collection("ratings").where("providerUid", "==", providerUid).get(),
      ]);
      const storedProfile = documentData(profileSnapshot) || {};
      const ratings = ratingsSnapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .sort((a, b) => {
          const first = a.createdAt?.toMillis?.() ?? new Date(a.createdAt || 0).getTime();
          const second = b.createdAt?.toMillis?.() ?? new Date(b.createdAt || 0).getTime();
          return second - first;
        });
      const count = ratings.length;
      const average = count
        ? ratings.reduce((total, item) => total + item.rating, 0) / count
        : 0;
      return {
        providerUid,
        average: Number(average.toFixed(2)),
        count,
        ratings,
        storedAverage: storedProfile.ratingAverage ?? 0,
      };
    } catch (error) {
      throw safeFirestoreError(error);
    }
  }

  async function getRequestRating({ requestId, clientUid } = {}) {
    validateRequestId(requestId);
    requireUid(clientUid);
    try {
      const requestSnapshot = await requestRef(requestId).get();
      const request = documentData(requestSnapshot);
      if (!request || request.clientUid !== clientUid) {
        throw serviceError("No encontramos esa solicitud.", 404, "REQUEST_NOT_FOUND");
      }
      const reviewSnapshot = await ratingRef(requestId).get();
      return reviewSnapshot.exists
        ? { id: reviewSnapshot.id, ...reviewSnapshot.data() }
        : null;
    } catch (error) {
      throw safeFirestoreError(error);
    }
  }

  return Object.freeze({
    createRequest,
    listRequests,
    getRequest,
    transitionRequest,
    createRating,
    listProviderRatings,
    getRequestRating,
    statuses: REQUEST_STATUSES,
  });
}
