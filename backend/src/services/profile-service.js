import { getAdminAuth, getAdminFirestore } from "../config/firebase-admin.js";
import {
  inspectProviderProfile,
  validatePersonalProfile,
  validateProviderProfile,
} from "./profile-validation.js";

const PROFILE_FIELDS = [
  "bio",
  "experienceYears",
  "coverageZone",
  "availability",
  "services",
];
const DEFAULT_PROVIDER_PROFILE = Object.freeze({
  bio: "",
  experienceYears: null,
  coverageZone: "",
  availability: "",
  services: [],
});

function serviceError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function requireUid(uid) {
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/")) {
    throw serviceError("El usuario solicitado no es válido.", 400, "INVALID_UID");
  }
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pickProviderFields(data = {}) {
  return Object.fromEntries(PROFILE_FIELDS.map((field) => [field, data[field] ?? DEFAULT_PROVIDER_PROFILE[field]]));
}

function hasProviderChanges(before, after) {
  return PROFILE_FIELDS.some((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

function toProviderProfile(uid, data = {}) {
  const fields = pickProviderFields(data);
  const assessment = inspectProviderProfile(fields);
  return {
    uid,
    ...fields,
    ratingCount: Number.isInteger(data.ratingCount) ? data.ratingCount : 0,
    ratingAverage: Number.isFinite(data.ratingAverage) ? data.ratingAverage : 0,
    profileComplete: assessment.complete,
    automaticValidation: data.automaticValidation || {
      status: "pending",
      missingFields: assessment.missingFields,
      checkedAt: null,
    },
    adminApproval: data.adminApproval || {
      status: "pending",
      reviewedAt: null,
      reviewedBy: null,
    },
  };
}

export function createProfileService({ db, auth, now = () => new Date() } = {}) {
  const firestore = () => db || getAdminFirestore();
  const firebaseAuth = () => auth || getAdminAuth();
  const userRef = (uid) => firestore().collection("users").doc(uid);
  const providerRef = (uid) => firestore().collection("providerProfiles").doc(uid);

  async function requireProvider(uid) {
    const userSnapshot = await userRef(uid).get();
    if (!userSnapshot.exists) throw serviceError("No encontramos tu perfil.", 404, "PROFILE_NOT_FOUND");
    if (userSnapshot.data()?.role !== "Proveedor") {
      throw serviceError("Esta operación solo está disponible para proveedores.", 403, "FORBIDDEN");
    }
  }

  async function getMyProfile(uid) {
    requireUid(uid);
    const snapshot = await userRef(uid).get();
    if (!snapshot.exists) throw serviceError("No encontramos tu perfil.", 404, "PROFILE_NOT_FOUND");
    const data = snapshot.data();
    return {
      uid,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      phone: data.phone || "",
    };
  }

  async function createInitialProfile({ uid, email, firstName, lastName, role } = {}) {
    requireUid(uid);
    if (typeof email !== "string" || !email.trim() || email.length > 254) {
      throw serviceError("El token no contiene un correo válido.", 400, "INVALID_PROFILE");
    }
    if (!["Cliente", "Proveedor"].includes(role)) {
      throw serviceError("Selecciona un tipo de cuenta válido.", 400, "INVALID_PROFILE");
    }
    const values = validatePersonalProfile({ firstName, lastName });
    const reference = userRef(uid);
    const timestamp = now().toISOString();
    let result;
    try {
      await firestore().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists) {
          const current = snapshot.data();
          if (
            current.email !== email.trim().toLowerCase()
            || current.role !== role
            || current.firstName !== values.firstName
            || current.lastName !== values.lastName
          ) throw serviceError("Ya existe un perfil para esta cuenta.", 409, "PROFILE_ALREADY_EXISTS");
          result = { uid, email: current.email, firstName: current.firstName, lastName: current.lastName, role: current.role, phone: current.phone || "" };
          return;
        }
        transaction.create(reference, {
          email: email.trim().toLowerCase(),
          ...values,
          role,
          createdAt: timestamp,
        });
        result = { uid, email: email.trim().toLowerCase(), ...values, role, phone: "" };
      });
    } catch (error) {
      if (Number.isInteger(error?.statusCode)) throw error;
      console.error("Initial profile creation failed:", error?.code || "unknown");
      throw serviceError("No se pudo guardar el perfil en este momento.", 503, "FIRESTORE_UNAVAILABLE");
    }
    return result;
  }

  async function updateMyProfile(uid, input) {
    requireUid(uid);
    const values = validatePersonalProfile(input);
    const reference = userRef(uid);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw serviceError("No encontramos tu perfil.", 404, "PROFILE_NOT_FOUND");
    await reference.update({ ...values, updatedAt: now().toISOString() });
    return getMyProfile(uid);
  }

  async function getProviderProfile(uid) {
    requireUid(uid);
    await requireProvider(uid);
    const snapshot = await providerRef(uid).get();
    return toProviderProfile(uid, snapshot.exists ? snapshot.data() : {});
  }

  async function updateProviderProfile(uid, input) {
    requireUid(uid);
    const values = validateProviderProfile(input);
    await requireProvider(uid);
    const reference = providerRef(uid);
    const timestamp = now().toISOString();
    let updated;

    await firestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.exists ? snapshot.data() : {};
      const oldFields = pickProviderFields(previous);
      const fields = { ...oldFields, ...values };
      const assessment = inspectProviderProfile(fields);
      const changed = !snapshot.exists || hasProviderChanges(oldFields, fields);
      const previousApproval = isRecord(previous.adminApproval) ? previous.adminApproval : {};

      updated = {
        ...(snapshot.exists ? previous : { createdAt: timestamp }),
        ...fields,
        updatedAt: timestamp,
        automaticValidation: {
          status: assessment.complete ? "passed" : "pending",
          missingFields: assessment.missingFields,
          checkedAt: timestamp,
        },
        adminApproval: changed
          ? { status: "pending", reviewedAt: null, reviewedBy: null }
          : {
              status: previousApproval.status || "pending",
              reviewedAt: previousApproval.reviewedAt || null,
              reviewedBy: previousApproval.reviewedBy || null,
            },
      };
      transaction.set(reference, updated, { merge: true });
    });

    return toProviderProfile(uid, updated);
  }

  async function getProviderEligibility(uid) {
    const profile = await getProviderProfile(uid);
    let accountActive = false;
    try {
      const account = await firebaseAuth().getUser(uid);
      accountActive = account.disabled !== true;
    } catch (error) {
      if (error?.code !== "auth/user-not-found")
        throw serviceError("No se pudo verificar el estado de la cuenta.", 503, "AUTH_UNAVAILABLE");
    }

    const reasons = [];
    if (!profile.profileComplete) reasons.push("Completa todos los campos del perfil profesional.");
    if (profile.automaticValidation.status !== "passed") {
      reasons.push("La validación automática del perfil está pendiente.");
    }
    if (profile.adminApproval.status !== "approved") {
      reasons.push("La aprobación administrativa está pendiente.");
    }
    if (!accountActive) reasons.push("La cuenta de Firebase Authentication no está activa.");
    return { eligible: reasons.length === 0, accountActive, reasons };
  }

  async function setProviderApproval(uid, status, adminUid) {
    requireUid(uid);
    requireUid(adminUid);
    if (uid === adminUid) {
      throw serviceError("No puedes aprobar tu propio perfil profesional.", 403, "FORBIDDEN");
    }
    if (!["approved", "rejected"].includes(status)) {
      throw serviceError("El estado debe ser approved o rejected.", 400, "INVALID_APPROVAL_STATUS");
    }
    await requireProvider(uid);
    let account;
    try {
      account = await firebaseAuth().getUser(uid);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        throw serviceError("La cuenta de Firebase Authentication no está activa.", 409, "ACCOUNT_DISABLED");
      }
      throw serviceError("No se pudo verificar el estado de la cuenta.", 503, "AUTH_UNAVAILABLE");
    }
    if (account.disabled === true) {
      throw serviceError("No se puede aprobar una cuenta deshabilitada.", 409, "ACCOUNT_DISABLED");
    }

    const reference = providerRef(uid);
    const timestamp = now().toISOString();
    let updated;
    await firestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) {
        throw serviceError("El proveedor todavía no ha completado su perfil.", 409, "PROFILE_INCOMPLETE");
      }
      const data = snapshot.data();
      const profile = toProviderProfile(uid, data);
      if (
        !profile.profileComplete
        || profile.automaticValidation.status !== "passed"
      ) {
        throw serviceError("El perfil debe superar la validación automática antes de la revisión.", 409, "PROFILE_INCOMPLETE");
      }
      updated = {
        ...data,
        adminApproval: { status, reviewedAt: timestamp, reviewedBy: adminUid },
        updatedAt: timestamp,
      };
      transaction.set(reference, updated, { merge: true });
    });
    return toProviderProfile(uid, updated);
  }

  return Object.freeze({
    createInitialProfile,
    getMyProfile,
    updateMyProfile,
    getProviderProfile,
    updateProviderProfile,
    getProviderEligibility,
    setProviderApproval,
  });
}
