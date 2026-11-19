// Capa de servicios de HogarFix.
// Todas las pantallas piden los datos a través de este módulo. Si js/config.js define
// API_BASE_URL, se llama al backend con fetch; si no, se usa el modo demostración
// (data/data.js + localStorage). Así el frontend no cambia cuando el backend esté listo.
import * as demoData from "../../data/data.js";
import { API_BASE_URL, DEMO_LATENCY_MS } from "../config.js";

export const USE_BACKEND = Boolean(API_BASE_URL);
const REQUESTS_KEY = "hogarfix.requests.v1";
const SESSION_KEY = "hogarfix.session.v1";

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
    demoData.proveedores.filter(
      (item) =>
        (!categoria || item.categorias.includes(categoria)) && (!disponible || item.available),
    ),
  );
}

// GET /proveedores/:id
export function getProveedor(id) {
  if (USE_BACKEND) return http(`/proveedores/${encodeURIComponent(id)}`);
  return demo(() => {
    const proveedor = demoData.proveedores.find((item) => item.id === id);
    if (!proveedor) throw new ApiError("No encontramos a este profesional.", 404);
    return { ...proveedor, resenas: demoData.resenas.filter((item) => item.proveedorId === id) };
  });
}

// GET /solicitudes (el backend filtra por el cliente autenticado)
export function getSolicitudes() {
  if (USE_BACKEND) return http("/solicitudes");
  const email = getSession()?.email;
  return demo(() =>
    readRequests().filter((item) => !email || !item.ownerEmail || item.ownerEmail === email),
  );
}

// GET /solicitudes/:id
export function getSolicitud(id) {
  if (USE_BACKEND) return http(`/solicitudes/${encodeURIComponent(id)}`);
  const email = getSession()?.email;
  return demo(() => {
    const solicitud = readRequests().find(
      (item) => item.id === id && (!email || !item.ownerEmail || item.ownerEmail === email),
    );
    if (!solicitud) throw new ApiError("No encontramos esa solicitud.", 404);
    return solicitud;
  });
}

// POST /solicitudes
// La tarifa NO se envía desde el formulario: la asigna el servidor según la categoría.
export function createSolicitud({ proveedorId, categoriaId, date, time, address, detail }) {
  const payload = { proveedorId, categoriaId, date, time, address, detail };
  if (USE_BACKEND) return http("/solicitudes", { method: "POST", body: JSON.stringify(payload) });
  return demo(() => {
    const categoria = findCategoria(categoriaId);
    const proveedor = demoData.proveedores.find((item) => item.id === proveedorId);
    if (!categoria) throw new ApiError("La categoría seleccionada no existe.", 400);
    if (!proveedor) throw new ApiError("El profesional seleccionado no existe.", 400);
    if (!proveedor.categorias.includes(categoria.id))
      throw new ApiError(`${proveedor.name} no presta servicios de ${categoria.nombre}.`, 400);
    const session = getSession();
    const solicitud = {
      id: `HF-${Date.now().toString(36).toUpperCase()}`,
      ownerEmail: session?.email || "cliente-demo",
      clientName: session ? `${session.firstName} ${session.lastName}` : "Cliente",
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
    const items = readRequests();
    const solicitud = items.find((item) => item.id === id);
    if (!solicitud) throw new ApiError("No encontramos esa solicitud.", 404);
    if (solicitud.status !== "Aceptada")
      throw new ApiError("Solo puedes confirmar solicitudes que el profesional ya aceptó.", 409);
    solicitud.status = "Confirmada";
    solicitud.confirmedAt = new Date().toISOString();
    writeRequests(items);
    return solicitud;
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
};
