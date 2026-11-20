// Capa de servicios de HogarFix.
// Todas las pantallas piden los datos a través de este módulo. Si js/config.js define
// API_BASE_URL, se llama al backend con fetch; si no, se usa el modo demostración
// (data/data.js + localStorage). Así el frontend no cambia cuando el backend esté listo.
import * as demoData from "../../data/data.js";
import { API_BASE_URL, DEMO_LATENCY_MS } from "../config.js";

export const USE_BACKEND = Boolean(API_BASE_URL);
const REQUESTS_KEY = "hogarfix.requests.v1";
const SESSION_KEY = "hogarfix.session.v1";
const PROFILES_KEY = "hogarfix.profiles.v1";
const ACCOUNTS_KEY = "hogarfix.accounts.v1";

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

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

/* ---------- Backend real ---------- */

async function http(path, options = {}) {
  const session = getSession();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
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

/* ---------- Perfiles (modo demostración) ---------- */

function readProfiles() {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeProfiles(profiles) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    throw new ApiError(
      "No hay espacio para guardar el perfil en este navegador. Prueba con una foto más liviana.",
    );
  }
}

export function providerIdFromEmail(email = "") {
  return `u-${String(email)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
}

function requireSession(role) {
  const session = getSession();
  if (!session?.email) throw new ApiError("Tu sesión terminó. Inicia sesión de nuevo.", 401);
  if (role && session.role !== role)
    throw new ApiError("Esta opción no está disponible para tu tipo de cuenta.", 403);
  return session;
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

// Proveedores registrados en este navegador que ya eligieron al menos una especialidad.
function registeredProviders() {
  const requests = readRequests();
  return Object.values(readProfiles())
    .filter((profile) => profile.role === "Proveedor" && profile.categorias?.length)
    .map((profile) => {
      const names = profile.categorias.map((id) => findCategoria(id)?.nombre).filter(Boolean);
      return {
        id: providerIdFromEmail(profile.email),
        email: profile.email,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        profession: profile.profession || names.join(" y "),
        categorias: profile.categorias,
        services: names,
        rating: null,
        jobs: requests.filter(
          (item) => item.providerEmail === profile.email && item.status === "Completada",
        ).length,
        reviews: 0,
        distanceKm: null,
        available: profile.available !== false,
        bio: profile.bio || "",
        phone: profile.phone || "",
        zone: profile.zone || "Bogotá, Colombia",
        availability: availabilityText(profile),
        photo: profile.photo || "",
        registered: true,
      };
    });
}

function allProviders() {
  return [...registeredProviders(), ...demoData.proveedores];
}

function paymentStatusFor(metodo) {
  return metodo.tipo === "contra-entrega" ? "Pago al finalizar el servicio" : "Pendiente de pago";
}

/* ---------- API pública ---------- */

// GET /categorias
export function getCategorias() {
  if (USE_BACKEND) return http("/categorias");
  return demo(demoData.categorias);
}

// GET /proveedores?categoria=&disponible=
export function getProveedores({ categoria, disponible } = {}) {
  if (USE_BACKEND) {
    const params = new URLSearchParams();
    if (categoria) params.set("categoria", categoria);
    if (disponible) params.set("disponible", "true");
    return http(`/proveedores${params.size ? `?${params}` : ""}`);
  }
  return demo(() =>
    allProviders().filter(
      (item) =>
        (!categoria || item.categorias.includes(categoria)) && (!disponible || item.available),
    ),
  );
}

// GET /proveedores/:id
export function getProveedor(id) {
  if (USE_BACKEND) return http(`/proveedores/${encodeURIComponent(id)}`);
  return demo(() => {
    const proveedor = allProviders().find((item) => item.id === id);
    if (!proveedor) throw new ApiError("No encontramos a este profesional.", 404);
    return { ...proveedor, resenas: demoData.resenas.filter((item) => item.proveedorId === id) };
  });
}

// GET /solicitudes (el backend filtra por el cliente autenticado)
export function getSolicitudes() {
  if (USE_BACKEND) return http("/solicitudes");
  const email = getSession()?.email;
  return demo(() => readRequests().filter((item) => item.ownerEmail === email));
}

// GET /solicitudes/:id
export function getSolicitud(id) {
  if (USE_BACKEND) return http(`/solicitudes/${encodeURIComponent(id)}`);
  const email = getSession()?.email;
  return demo(() => {
    const solicitud = readRequests().find((item) => item.id === id && item.ownerEmail === email);
    if (!solicitud) throw new ApiError("No encontramos esa solicitud.", 404);
    return solicitud;
  });
}

// POST /solicitudes
// La tarifa NO se envía desde el formulario: la asigna el servidor según la categoría.
export function createSolicitud({
  proveedorId,
  categoriaId,
  metodoPagoId,
  date,
  time,
  address,
  detail,
}) {
  const payload = { proveedorId, categoriaId, metodoPagoId, date, time, address, detail };
  if (USE_BACKEND) return http("/solicitudes", { method: "POST", body: JSON.stringify(payload) });
  return demo(() => {
    const categoria = findCategoria(categoriaId);
    const proveedor = allProviders().find((item) => item.id === proveedorId);
    const metodo = demoData.metodosPago.find((item) => item.id === metodoPagoId);
    if (!categoria) throw new ApiError("La categoría seleccionada no existe.", 400);
    if (!metodo) throw new ApiError("Selecciona un método de pago válido.", 400);
    if (!proveedor) throw new ApiError("El profesional seleccionado no existe.", 400);
    if (!proveedor.categorias.includes(categoria.id))
      throw new ApiError(`${proveedor.name} no presta servicios de ${categoria.nombre}.`, 400);
    const session = requireSession("Cliente");
    if (proveedor.email && proveedor.email === session.email)
      throw new ApiError("No puedes solicitarte un servicio a ti mismo.", 400);
    const solicitud = {
      id: `HF-${Date.now().toString(36).toUpperCase()}`,
      ownerEmail: session.email,
      clientName: `${session.firstName} ${session.lastName}`,
      providerId: proveedor.id,
      providerEmail: proveedor.email || null,
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
  });
}

// PATCH /solicitudes/:id/confirmar
export function confirmarSolicitud(id) {
  if (USE_BACKEND)
    return http(`/solicitudes/${encodeURIComponent(id)}/confirmar`, { method: "PATCH" });
  return demo(() => {
    const session = requireSession("Cliente");
    const items = readRequests();
    const solicitud = items.find((item) => item.id === id && item.ownerEmail === session.email);
    if (!solicitud) throw new ApiError("No encontramos esa solicitud.", 404);
    if (solicitud.status !== "Aceptada")
      throw new ApiError("Solo puedes confirmar solicitudes que el profesional ya aceptó.", 409);
    solicitud.status = "Confirmada";
    solicitud.confirmedAt = new Date().toISOString();
    writeRequests(items);
    return solicitud;
  });
}

// GET /pagos/metodos
// Solo describe las opciones. El cobro real lo hará la pasarela que defina el equipo
// (con tokenización); HogarFix nunca recibe ni guarda números de tarjeta ni códigos CVV.
export function getMetodosPago() {
  if (USE_BACKEND) return http("/pagos/metodos");
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
  if (USE_BACKEND) return http("/proveedor/solicitudes");
  return demo(() => {
    const session = requireSession("Proveedor");
    return readRequests().filter((item) => item.providerEmail === session.email);
  });
}

// PATCH /solicitudes/:id/estado
export function cambiarEstadoSolicitud(id, estado) {
  if (USE_BACKEND)
    return http(`/solicitudes/${encodeURIComponent(id)}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });
  return demo(() => {
    const session = requireSession("Proveedor");
    const items = readRequests();
    const solicitud = items.find((item) => item.id === id && item.providerEmail === session.email);
    if (!solicitud) throw new ApiError("No encontramos esa solicitud.", 404);
    if (!(TRANSICIONES[solicitud.status] || []).includes(estado))
      throw new ApiError(`No se puede pasar de "${solicitud.status}" a "${estado}".`, 409);
    solicitud.status = estado;
    solicitud.updatedAt = new Date().toISOString();
    writeRequests(items);
    return solicitud;
  });
}

/* ---------- Perfil del usuario autenticado ---------- */

// GET /perfil
export function getPerfil() {
  if (USE_BACKEND) return http("/perfil");
  return demo(() => {
    const session = requireSession();
    const saved = readProfiles()[session.email] || {};
    return {
      firstName: session.firstName,
      lastName: session.lastName,
      ...saved,
      email: session.email,
      role: session.role,
    };
  });
}

// PUT /perfil
// Cada usuario solo puede cambiar su propio perfil: el correo y el rol salen de la sesión,
// nunca del formulario. Con Firebase, el documento será usuarios/{uid}.
export function updatePerfil(cambios) {
  if (USE_BACKEND) return http("/perfil", { method: "PUT", body: JSON.stringify(cambios) });
  return demo(() => {
    const session = requireSession();
    const firstName = String(cambios.firstName || "").trim();
    const lastName = String(cambios.lastName || "").trim();
    if (!firstName || !lastName)
      throw new ApiError("El nombre y el apellido son obligatorios.", 400);
    const profiles = readProfiles();
    const { email: _email, role: _role, ...rest } = cambios;
    const profile = {
      ...profiles[session.email],
      ...rest,
      firstName,
      lastName,
      email: session.email,
      role: session.role,
      updatedAt: new Date().toISOString(),
    };
    profiles[session.email] = profile;
    writeProfiles(profiles);

    // Mantener el nombre al día en la sesión y en la cuenta para el próximo ingreso.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, firstName, lastName }));
    try {
      const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
      const account = accounts.find((item) => item.email === session.email);
      if (account) {
        account.firstName = firstName;
        account.lastName = lastName;
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      }
    } catch {
      /* La cuenta se actualizará en el siguiente guardado. */
    }
    return profile;
  });
}

export const api = {
  API_BASE_URL,
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
  cambiarEstadoSolicitud,
  getPerfil,
  updatePerfil,
};
