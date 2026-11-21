const PERSONAL_FIELDS = new Set(["firstName", "lastName", "phone"]);
const PROVIDER_FIELDS = new Set([
  "bio",
  "experienceYears",
  "coverageZone",
  "availability",
  "services",
]);
const SERVICE_CATEGORY_IDS = new Set([
  "plomeria",
  "electricidad",
  "jardineria",
  "aseo-general",
]);

function invalidProfile(message) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: "INVALID_PROFILE",
  });
}

function requireRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidProfile("Envía los datos del perfil en formato JSON.");
  }
  return value;
}

function rejectUnknownFields(value, allowedFields) {
  const unknownFields = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unknownFields.length) {
    throw invalidProfile(`No se permiten estos campos del perfil: ${unknownFields.join(", ")}.`);
  }
}

function normalizeText(value, field, maxLength, { allowEmpty = true } = {}) {
  if (typeof value !== "string") throw invalidProfile(`El campo ${field} debe ser texto.`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw invalidProfile(`El campo ${field} no puede estar vacío.`);
  if (normalized.length > maxLength) {
    throw invalidProfile(`El campo ${field} supera el máximo de ${maxLength} caracteres.`);
  }
  return normalized;
}

export function validatePersonalProfile(input) {
  const values = requireRecord(input);
  rejectUnknownFields(values, PERSONAL_FIELDS);
  if (!Object.keys(values).length) throw invalidProfile("Indica al menos un dato personal para actualizar.");

  const normalized = {};
  if ("firstName" in values) {
    normalized.firstName = normalizeText(values.firstName, "firstName", 80, { allowEmpty: false });
  }
  if ("lastName" in values) {
    normalized.lastName = normalizeText(values.lastName, "lastName", 80, { allowEmpty: false });
  }
  if ("phone" in values) {
    normalized.phone = normalizeText(values.phone, "phone", 24);
    if (normalized.phone) {
      const digitCount = normalized.phone.replace(/\D/g, "").length;
      if (
        !/^[+()\d.\s-]{7,24}$/.test(normalized.phone)
        || digitCount < 7
        || digitCount > 15
      ) {
        throw invalidProfile("Escribe un número de teléfono válido.");
      }
    }
  }
  return normalized;
}

export function validateProviderProfile(input) {
  const values = requireRecord(input);
  rejectUnknownFields(values, PROVIDER_FIELDS);
  if (!Object.keys(values).length) {
    throw invalidProfile("Indica al menos un dato profesional para actualizar.");
  }

  const normalized = {};
  if ("bio" in values) normalized.bio = normalizeText(values.bio, "bio", 1000);
  if ("coverageZone" in values) {
    normalized.coverageZone = normalizeText(values.coverageZone, "coverageZone", 160);
  }
  if ("availability" in values) {
    normalized.availability = normalizeText(values.availability, "availability", 200);
  }
  if ("experienceYears" in values) {
    const experience = values.experienceYears;
    if (
      experience !== null
      && (!Number.isInteger(experience) || experience < 0 || experience > 70)
    ) {
      throw invalidProfile("La experiencia debe ser un número entero entre 0 y 70.");
    }
    normalized.experienceYears = experience;
  }
  if ("services" in values) {
    if (
      !Array.isArray(values.services)
      || values.services.length > SERVICE_CATEGORY_IDS.size
      || values.services.some((service) => typeof service !== "string")
    ) {
      throw invalidProfile("Selecciona categorías de servicio válidas.");
    }
    const services = values.services.map((service) => service.trim().toLowerCase());
    if (services.some((service) => !SERVICE_CATEGORY_IDS.has(service))) {
      throw invalidProfile("Selecciona únicamente categorías de servicio disponibles.");
    }
    if (new Set(services.map((service) => service.toLocaleLowerCase("es"))).size !== services.length) {
      throw invalidProfile("No repitas un servicio.");
    }
    normalized.services = services;
  }
  return normalized;
}

export function inspectProviderProfile(profile) {
  const missingFields = [];
  if (
    !Array.isArray(profile.services)
    || profile.services.length === 0
    || profile.services.some((service) => !SERVICE_CATEGORY_IDS.has(service))
    || new Set(profile.services).size !== profile.services.length
  ) {
    missingFields.push("services");
  }
  if (typeof profile.bio !== "string" || profile.bio.length < 30 || profile.bio.length > 1000) {
    missingFields.push("bio");
  }
  if (
    !Number.isInteger(profile.experienceYears)
    || profile.experienceYears < 0
    || profile.experienceYears > 70
  ) {
    missingFields.push("experienceYears");
  }
  if (
    typeof profile.coverageZone !== "string"
    || !profile.coverageZone
    || profile.coverageZone.length > 160
  ) {
    missingFields.push("coverageZone");
  }
  if (
    typeof profile.availability !== "string"
    || !profile.availability
    || profile.availability.length > 200
  ) {
    missingFields.push("availability");
  }

  return {
    complete: missingFields.length === 0,
    missingFields,
  };
}