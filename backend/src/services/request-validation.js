export const REQUEST_TIME_ZONE = "America/Bogota";
export const REQUEST_STATUSES = Object.freeze([
  "Pendiente",
  "Aceptada",
  "Rechazada",
  "Confirmada",
  "En proceso",
  "Completada",
  "Cancelada",
]);

const CREATE_FIELDS = new Set([
  "providerCatalogId",
  "categoryId",
  "date",
  "time",
  "address",
  "detail",
]);
const MAX_SCHEDULE_DAYS = 60;

function requestError(message, statusCode = 400, code = "INVALID_REQUEST") {
  return Object.assign(new Error(message), { statusCode, code });
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeDocumentId(value, field) {
  if (typeof value !== "string") {
    throw requestError(`El campo ${field} debe ser texto.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || normalized.includes("/")) {
    throw requestError(`El campo ${field} no es válido.`);
  }
  return normalized;
}

function normalizeText(value, field, minLength, maxLength) {
  if (typeof value !== "string") {
    throw requestError(`El campo ${field} debe ser texto.`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw requestError(`El campo ${field} debe tener entre ${minLength} y ${maxLength} caracteres.`);
  }
  return normalized;
}

function parseLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw requestError("La fecha debe usar el formato AAAA-MM-DD.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw requestError("La fecha indicada no existe.");
  }
  return { year, month, day };
}

function getBogotaDateTimeParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REQUEST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function localDateTimeToDate({ year, month, day }, time) {
  const [hour, minute] = time.split(":").map(Number);
  // America/Bogota uses UTC-05:00 and has no daylight-saving changes.
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
}

export function validateIdempotencyKey(value) {
  if (typeof value !== "string") {
    throw requestError("Se requiere una clave de idempotencia válida.", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  const key = value.trim();
  if (!/^[\w.-]{16,128}$/.test(key)) {
    throw requestError(
      "La clave de idempotencia debe tener entre 16 y 128 caracteres válidos.",
      400,
      "INVALID_IDEMPOTENCY_KEY",
    );
  }
  return key;
}

export function validateCreateRequest(input, { now = new Date() } = {}) {
  if (!isRecord(input)) {
    throw requestError("Envía los datos de la solicitud en formato JSON.");
  }

  const unknownFields = Object.keys(input).filter((field) => !CREATE_FIELDS.has(field));
  if (unknownFields.length) {
    throw requestError(
      `No se permiten estos campos de la solicitud: ${unknownFields.join(", ")}.`,
      400,
      "PROTECTED_REQUEST_FIELDS",
    );
  }

  const missingFields = [...CREATE_FIELDS].filter(
    (field) => !Object.prototype.hasOwnProperty.call(input, field),
  );
  if (missingFields.length) {
    throw requestError(`Faltan campos obligatorios: ${missingFields.join(", ")}.`);
  }

  const localDate = parseLocalDate(input.date);
  if (typeof input.time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    throw requestError("La hora debe usar el formato de 24 horas HH:mm.");
  }

  const scheduledAt = localDateTimeToDate(localDate, input.time);
  const currentTime = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(currentTime.getTime()) || scheduledAt <= currentTime) {
    throw requestError("La fecha y hora del servicio deben ser futuras.");
  }
  if (scheduledAt.getTime() > currentTime.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
    throw requestError("Solo puedes agendar con hasta 60 días de anticipación.");
  }

  const bogotaParts = getBogotaDateTimeParts(currentTime);
  const todayInBogota = `${bogotaParts.year}-${bogotaParts.month}-${bogotaParts.day}`;
  if (input.date < todayInBogota) {
    throw requestError("La fecha del servicio no puede ser anterior a hoy.");
  }

  return {
    providerCatalogId: normalizeDocumentId(input.providerCatalogId, "providerCatalogId"),
    categoryId: normalizeDocumentId(input.categoryId, "categoryId"),
    date: input.date,
    time: input.time,
    timeZone: REQUEST_TIME_ZONE,
    scheduledAt,
    address: normalizeText(input.address, "address", 8, 120),
    detail: normalizeText(input.detail, "detail", 15, 500),
  };
}

export function createRequestError(message, statusCode, code) {
  return requestError(message, statusCode, code);
}
