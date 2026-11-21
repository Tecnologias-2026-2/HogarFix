// Capa de servicios de HogarFix.
// Los servicios de demostración usan data/data.js y localStorage; los perfiles
// personales y profesionales requieren el backend y no tienen fallback local.
import * as demoData from "../../data/data.js";
import {
  DEMO_LATENCY_MS,
  PROFILE_API_BASE_URL,
  REQUESTS_API_BASE_URL,
} from "../config.js";
import { getAuthState } from "./auth.js";

export const USE_PROFILE_BACKEND = Boolean(PROFILE_API_BASE_URL);
export const USE_REQUESTS_BACKEND = Boolean(REQUESTS_API_BASE_URL);
// Compatibilidad con consumidores existentes; el enrutamiento usa los flags por módulo.
export const USE_BACKEND = USE_PROFILE_BACKEND || USE_REQUESTS_BACKEND;
const REQUESTS_KEY = "hogarfix.requests.v1";

export const ESTADOS = [
  "Pendiente",
  "Aceptada",
  "Confirmada",
  "En proceso",
  "Completada",
  "Rechazada",
  "Cancelada",
];

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const clone = (value) => structuredClone(value);

async function requireAuthState() {
  const state = await getAuthState();
  if (!state.user) throw new ApiError("Inicia sesión para continuar.", 401);
  if (state.error || !state.profile)
    throw new ApiError("No se pudo validar tu perfil. Vuelve a iniciar sesión.");
  return state;
}

/* ---------- Backend real ---------- */

async function http(baseUrl, configName, path, options = {}, requiresAuth = false) {
  if (!baseUrl) {
    throw new ApiError(
      `La URL del backend no está configurada. Define ${configName} en js/config.js.`,
      503,
    );
  }
  const headers = { "Content-Type": "application/json", ...options.headers };
  const state = requiresAuth ? await requireAuthState() : await getAuthState();
  if (!requiresAuth && state.error) throw new ApiError("No se pudo validar tu perfil.");
  if (state.user) headers.Authorization = `Bearer ${await state.user.getIdToken()}`;
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
  }
  if (!response.ok) {
    let message = `El servidor respondió con un error (${response.status}).`;
    try {
      message = (await response.json()).message || message;
    } catch {
      /* Respuesta sin cuerpo JSON. */
    }
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? null : response.json();
}

function profileHttp(path, options = {}) {
  return http(PROFILE_API_BASE_URL, "PROFILE_API_BASE_URL", path, options, true);
}

function requestsHttp(path, options = {}) {
  return http(REQUESTS_API_BASE_URL, "REQUESTS_API_BASE_URL", path, options, true);
}

function normalizeTimestamp(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  if (!value || typeof value !== "object") return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();

  const seconds = Number.isFinite(value.seconds) ? value.seconds : value._seconds;
  const nanoseconds = Number.isFinite(value.nanoseconds)
    ? value.nanoseconds
    : value._nanoseconds;
  if (!Number.isFinite(seconds)) return "";
  const date = new Date(seconds * 1000 + (Number(nanoseconds) || 0) / 1e6);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeRequest(request) {
  if (!request || typeof request !== "object" || typeof request.id !== "string") {
    throw new ApiError("El servidor devolvió una solicitud con formato inválido.");
  }
  const category = request.categorySnapshot || {};
  const provider = request.providerSnapshot || {};
  const amount = category.priceCOP ?? category.fixedPriceCOP;
  if (
    typeof request.status !== "string"
    || typeof request.date !== "string"
    || typeof request.time !== "string"
    || typeof request.address !== "string"
    || typeof request.detail !== "string"
    || typeof category.name !== "string"
    || typeof provider.displayName !== "string"
    || !Number.isFinite(amount)
  ) {
    throw new ApiError("El servidor devolvió una solicitud incompleta o incompatible.");
  }
  return {
    ...request,
    createdAt: normalizeTimestamp(request.createdAt),
    updatedAt: normalizeTimestamp(request.updatedAt),
    acceptedAt: normalizeTimestamp(request.acceptedAt),
    rejectedAt: normalizeTimestamp(request.rejectedAt),
    confirmedAt: normalizeTimestamp(request.confirmedAt),
    cancelledAt: normalizeTimestamp(request.cancelledAt),
    startedAt: normalizeTimestamp(request.startedAt),
    completedAt: normalizeTimestamp(request.completedAt),
    clientName: request.clientDisplayName || "",
    provider: provider.displayName || "",
    providerProfession: category.name || "",
    service: category.name || "",
    amount,
    categoriaId: request.categoryId,
  };
}

function unwrapRequest(response) {
  if (!response?.request) {
    throw new ApiError("El servidor devolvió una respuesta de solicitud con formato inválido.");
  }
  return normalizeRequest(response.request);
}

function unwrapRequests(response) {
  if (!Array.isArray(response?.requests)) {
    throw new ApiError("El servidor devolvió una lista de solicitudes con formato inválido.");
  }
  return response.requests.map(normalizeRequest);
}

function unavailableCatalog() {
  return Promise.reject(
    new ApiError(
      "El backend de solicitudes todavía no ofrece un catálogo real de categorías y proveedores.",
      503,
    ),
  );
}

/* ---------- Modo demostración ---------- */

function demo(result) {
  // ?simularError=1 en la URL permite mostrar los estados de error durante la presentación.
  const failing = new URLSearchParams(location.search).has("simularError");
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (failing) reject(new ApiError("No se pudo conectar con el servidor (error simulado)."));
      else {
        try {
          resolve(clone(typeof result === "function" ? result() : result));
        } catch (error) {
          reject(error);
        }
      }
    }, DEMO_LATENCY_MS),
  );
}

function readRequests() {
  try {
    const value = JSON.parse(localStorage.getItem(REQUESTS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeRequests(items) {
  try {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(items));
  } catch {
    throw new ApiError("No se pudo guardar la información en este navegador.");
  }
}

function findCategoria(idOrName) {
  const key = String(idOrName || "").toLowerCase();
  return demoData.categorias.find((item) => item.id === key || item.nombre.toLowerCase() === key);
}

/* ---------- Datos auxiliares del modo demostración ---------- */

export function providerIdFromEmail(email = "") {
  return `u-${String(email)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
}

const DAY_LABELS = {
  lun: "Lun",
  mar: "Mar",
  mie: "Mié",
  jue: "Jue",
  vie: "Vie",
  sab: "Sáb",
  dom: "Dom",
};

export function availabilityText(profile = {}) {
  const days = (profile.days || []).map((day) => DAY_LABELS[day]).filter(Boolean);
  if (!days.length) return "Horario por definir";
  const hours =
    profile.startTime && profile.endTime ? `, ${profile.startTime} - ${profile.endTime}` : "";
  return `${days.join(", ")}${hours}`;
}

function allProviders() {
  return demoData.proveedores;
}

function paymentStatusFor(metodo) {
  return metodo.tipo === "contra-entrega"
    ? "Pendiente: pagar al finalizar"
    : "Pendiente de pago";
}

/* ---------- API pública ---------- */

// GET /categorias
export function getCategorias() {
  if (USE_REQUESTS_BACKEND) return unavailableCatalog();
  return demo(demoData.categorias);
}

// GET /proveedores?categoria=&disponible=
export function getProveedores({ categoria, disponible } = {}) {
  if (USE_REQUESTS_BACKEND) return unavailableCatalog();
  return demo(() =>
    allProviders().filter(
      (item) =>
        (!categoria || item.categorias.includes(categoria)) && (!disponible || item.available),
    ),
  );
}

// GET /proveedores/:id
export function getProveedor(id) {
  if (USE_REQUESTS_BACKEND) return unavailableCatalog();
  return demo(() => {
    const proveedor = allProviders().find((item) => item.id === id);
    if (!proveedor) throw new ApiError("No encontramos a este profesional.", 404);
    return { ...proveedor, resenas: demoData.resenas.filter((item) => item.proveedorId === id) };
  });
}

// GET /solicitudes (el backend filtra por el cliente autenticado)
export function getSolicitudes() {
  if (USE_REQUESTS_BACKEND) return requestsHttp("/solicitudes").then(unwrapRequests);
  return requireAuthState().then(({ user }) =>
    demo(() => readRequests().filter((item) => item.ownerEmail === user.email)),
  );
}

// GET /solicitudes/:id
export function getSolicitud(id) {
  if (USE_REQUESTS_BACKEND)
    return requestsHttp(`/solicitudes/${encodeURIComponent(id)}`).then(unwrapRequest);
  return requireAuthState().then(({ user }) =>
    demo(() => {
      const solicitud = readRequests().find(
        (item) => item.id === id && item.ownerEmail === user.email,
      );
      if (!solicitud) throw new ApiError("No encontramos esa solicitud.", 404);
      return solicitud;
    }),
  );
}

// POST /solicitudes
// La tarifa NO se envía desde el formulario: la asigna el servidor según la categoría.
export function createSolicitud({
  proveedorId,
  categoriaId,
  metodoPagoId,
  providerCatalogId,
  categoryId,
  date,
  time,
  address,
  detail,
  idempotencyKey,
}) {
  if (USE_REQUESTS_BACKEND) {
    if (!providerCatalogId || !categoryId) {
      throw new ApiError(
        "No se puede crear la solicitud sin los identificadores reales del catálogo.",
        503,
      );
    }
    if (typeof idempotencyKey !== "string" || !/^[\w.-]{16,128}$/.test(idempotencyKey)) {
      throw new ApiError("No se pudo generar una clave de idempotencia válida para la solicitud.");
    }
    const payload = { providerCatalogId, categoryId, date, time, address, detail };
    return requestsHttp("/solicitudes", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    }).then(unwrapRequest);
  }

  return requireAuthState().then(({ user, profile }) =>
    demo(() => {
      const categoria = findCategoria(categoriaId);
      const proveedor = allProviders().find((item) => item.id === proveedorId);
      const metodo = demoData.metodosPago.find((item) => item.id === metodoPagoId);
      if (profile.role !== "Cliente")
        throw new ApiError("Solo los clientes pueden crear solicitudes.", 403);
      if (!categoria) throw new ApiError("La categoría seleccionada no existe.", 400);
      if (!proveedor) throw new ApiError("El profesional seleccionado no existe.", 400);
      if (!metodo) throw new ApiError("Selecciona un método de pago válido.", 400);
      if (!proveedor.categorias.includes(categoria.id))
        throw new ApiError(`${proveedor.name} no presta servicios de ${categoria.nombre}.`, 400);
      if (proveedor.email && proveedor.email === user.email)
        throw new ApiError("No puedes solicitarte un servicio a ti mismo.", 400);
      const solicitud = {
        id: `HF-${Date.now().toString(36).toUpperCase()}`,
        ownerEmail: user.email,
        clientName: `${profile.firstName} ${profile.lastName}`,
        providerId: proveedor.id,
        provider: proveedor.name,
        providerProfession: proveedor.profession,
        categoriaId: categoria.id,
        service: categoria.nombre,
        date,
        time,
        address: String(address).trim(),
        detail: String(detail).trim(),
        amount: categoria.tarifa,
        paymentMethod: { id: metodo.id, nombre: metodo.nombre, tipo: metodo.tipo },
        paymentStatus: paymentStatusFor(metodo),
        status: "Pendiente",
        createdAt: new Date().toISOString(),
      };
      writeRequests([solicitud, ...readRequests()]);
      return solicitud;
    }),
  );
}

// PATCH /solicitudes/:id/confirmar
export function confirmarSolicitud(id) {
  if (USE_REQUESTS_BACKEND)
    return requestsHttp(`/solicitudes/${encodeURIComponent(id)}/confirmar`, {
      method: "PATCH",
    }).then(unwrapRequest);
  return requireAuthState().then(({ user, profile }) =>
    demo(() => {
      if (profile.role !== "Cliente")
        throw new ApiError("Solo los clientes pueden confirmar solicitudes.", 403);
      const items = readRequests();
      const solicitud = items.find((item) => item.id === id && item.ownerEmail === user.email);
      if (!solicitud) throw new ApiError("No encontramos esa solicitud.", 404);
      if (solicitud.status !== "Aceptada")
        throw new ApiError("Solo puedes confirmar solicitudes que el profesional ya aceptó.", 409);
      solicitud.status = "Confirmada";
      solicitud.confirmedAt = new Date().toISOString();
      writeRequests(items);
      return solicitud;
    }),
  );
}

// Los métodos de pago son opciones informativas del modo demostración; no hay endpoint de pagos.
export function getMetodosPago() {
  return demo(demoData.metodosPago);
}

/* ---------- Solicitudes del proveedor autenticado ---------- */

const TRANSICIONES = {
  Pendiente: ["Aceptada", "Rechazada"],
  Confirmada: ["En proceso"],
  "En proceso": ["Completada"],
};

// GET /proveedor/solicitudes (solo las del proveedor autenticado)
export function getSolicitudesProveedor() {
  if (USE_REQUESTS_BACKEND) return requestsHttp("/provider/solicitudes").then(unwrapRequests);
  return requireAuthState().then(({ user, profile }) =>
    demo(() => {
      if (profile.role !== "Proveedor")
        throw new ApiError("Esta opción está disponible solo para proveedores.", 403);
      return readRequests().filter((item) => item.providerEmail === user.email);
    }),
  );
}

export function getSolicitudProveedor(id) {
  if (USE_REQUESTS_BACKEND)
    return requestsHttp(`/provider/solicitudes/${encodeURIComponent(id)}`).then(unwrapRequest);
  return requireAuthState().then(({ user, profile }) =>
    demo(() => {
      if (profile.role !== "Proveedor")
        throw new ApiError("Esta opción está disponible solo para proveedores.", 403);
      const request = readRequests().find(
        (item) => item.id === id && item.providerEmail === user.email,
      );
      if (!request) throw new ApiError("No encontramos esa solicitud entre las tuyas.", 404);
      return request;
    }),
  );
}

// PATCH /provider/solicitudes/:id/{aceptar,rechazar,iniciar,completar}
export function cambiarEstadoSolicitud(id, status) {
  if (USE_REQUESTS_BACKEND) {
    const actions = {
      Aceptada: "aceptar",
      Rechazada: "rechazar",
      "En proceso": "iniciar",
      Completada: "completar",
    };
    const action = actions[status];
    if (!action) throw new ApiError("La transición de estado solicitada no es válida.", 400);
    return requestsHttp(
      `/provider/solicitudes/${encodeURIComponent(id)}/${action}`,
      { method: "PATCH" },
    ).then(unwrapRequest);
  }
  return requireAuthState().then(({ user, profile }) =>
    demo(() => {
      if (profile.role !== "Proveedor")
        throw new ApiError("Esta opción está disponible solo para proveedores.", 403);
      const items = readRequests();
      const solicitud = items.find((item) => item.id === id && item.providerEmail === user.email);
      if (!solicitud) throw new ApiError("No encontramos esa solicitud.", 404);
      if (!(TRANSICIONES[solicitud.status] || []).includes(status))
        throw new ApiError(`No se puede pasar de "${solicitud.status}" a "${status}".`, 409);
      solicitud.status = status;
      solicitud.updatedAt = new Date().toISOString();
      writeRequests(items);
      return solicitud;
    }),
  );
}

/* ---------- Perfiles autenticados ---------- */

export function getMyProfile() {
  return profileHttp("/profile/me");
}

export function updateMyProfile(profile) {
  return profileHttp("/profile/me", { method: "PATCH", body: JSON.stringify(profile) });
}

export function getProviderProfile() {
  return profileHttp("/provider/profile/me");
}

export function updateProviderProfile(profile) {
  return profileHttp("/provider/profile/me", {
    method: "PATCH",
    body: JSON.stringify(profile),
  });
}

export function getProviderEligibility() {
  return profileHttp("/provider/eligibility");
}

export async function getPerfil() {
  const { profile: authProfile } = await requireAuthState();
  const personal = (await getMyProfile())?.profile;
  if (!personal || typeof personal !== "object") {
    throw new ApiError("El servidor devolvió un perfil personal con formato inválido.");
  }
  const professional =
    authProfile.role === "Proveedor" ? (await getProviderProfile())?.profile : null;
  return { ...authProfile, ...personal, ...(professional || {}) };
}

export async function updatePerfil(changes) {
  const { profile } = await requireAuthState();
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new ApiError("Los cambios del perfil deben ser un objeto.", 400);
  }
  const personalFields = new Set(["firstName", "lastName", "phone"]);
  const professionalFields = new Set([
    "bio",
    "experienceYears",
    "coverageZone",
    "availability",
    "services",
  ]);
  const keys = Object.keys(changes);
  const unknown = keys.filter(
    (key) => !personalFields.has(key) && !professionalFields.has(key),
  );
  if (!keys.length || unknown.length) {
    throw new ApiError(
      unknown.length
        ? `El perfil backend no admite estos campos: ${unknown.join(", ")}.`
        : "Indica al menos un campo de perfil para actualizar.",
      400,
    );
  }
  const hasPersonal = keys.some((key) => personalFields.has(key));
  const hasProfessional = keys.some((key) => professionalFields.has(key));
  if (hasPersonal && hasProfessional) {
    throw new ApiError("Actualiza los datos personales y profesionales en formularios separados.", 400);
  }
  if (hasProfessional && profile.role !== "Proveedor") {
    throw new ApiError("Solo los proveedores pueden editar los datos profesionales.", 403);
  }
  if (!hasProfessional && profile.role === "Proveedor" && !USE_PROFILE_BACKEND) {
    throw new ApiError("La edición del perfil requiere configurar PROFILE_API_BASE_URL.", 503);
  }
  if (hasProfessional) await updateProviderProfile(changes);
  else await updateMyProfile(changes);
  return getPerfil();
}

export const api = {
  PROFILE_API_BASE_URL,
  REQUESTS_API_BASE_URL,
  USE_PROFILE_BACKEND,
  USE_REQUESTS_BACKEND,
  USE_BACKEND,
  getCategorias,
  getProveedores,
  getProveedor,
  getSolicitudes,
  getSolicitud,
  createSolicitud,
  confirmarSolicitud,
  getMetodosPago,
  getSolicitudesProveedor,
  getSolicitudProveedor,
  cambiarEstadoSolicitud,
  getMyProfile,
  updateMyProfile,
  getProviderProfile,
  updateProviderProfile,
  getProviderEligibility,
  getPerfil,
  updatePerfil,
};
