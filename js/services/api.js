import * as demoData from "../../data/data.js";
import { API_BASE_URL } from "../config.js";

const resources = {
  usuarios: demoData.usuarios,
  sesiones: demoData.sesiones,
  busquedas: demoData.busquedas,
  solicitudes: demoData.solicitudes,
  proveedores: demoData.proveedores,
  mensajes: demoData.mensajes
};

const clone = (value) => structuredClone(value);

async function getAll(entity) {
  return clone(resources[entity] ?? []);
}

async function create(entity, payload) {
  if (!resources[entity]) throw new Error(`Entidad desconocida: ${entity}`);
  const record = { ...payload, id: payload.id ?? globalThis.crypto?.randomUUID?.() ?? `${entity}-${Date.now()}` };
  resources[entity].push(record);
  return clone(record);
}

async function update(entity, id, payload) {
  if (!resources[entity]) throw new Error(`Entidad desconocida: ${entity}`);
  const index = resources[entity].findIndex((record) => record.id === id);
  if (index < 0) return null;
  resources[entity][index] = { ...resources[entity][index], ...payload, id };
  return clone(resources[entity][index]);
}

async function remove(entity, id) {
  if (!resources[entity]) throw new Error(`Entidad desconocida: ${entity}`);
  const index = resources[entity].findIndex((record) => record.id === id);
  if (index < 0) return false;
  resources[entity].splice(index, 1);
  return true;
}

export const api = {
  API_BASE_URL,
  getUsuarios: () => getAll("usuarios"),
  createUsuario: (payload) => create("usuarios", payload),
  updateUsuario: (id, payload) => update("usuarios", id, payload),
  deleteUsuario: (id) => remove("usuarios", id),
  getSesiones: () => getAll("sesiones"),
  createSesion: (payload) => create("sesiones", payload),
  updateSesion: (id, payload) => update("sesiones", id, payload),
  deleteSesion: (id) => remove("sesiones", id),
  getBusquedas: () => getAll("busquedas"),
  createBusqueda: (payload) => create("busquedas", payload),
  updateBusqueda: (id, payload) => update("busquedas", id, payload),
  deleteBusqueda: (id) => remove("busquedas", id),
  getSolicitudes: () => getAll("solicitudes"),
  createSolicitud: (payload) => create("solicitudes", payload),
  updateSolicitud: (id, payload) => update("solicitudes", id, payload),
  deleteSolicitud: (id) => remove("solicitudes", id),
  getProveedores: () => getAll("proveedores"),
  createProveedor: (payload) => create("proveedores", payload),
  updateProveedor: (id, payload) => update("proveedores", id, payload),
  deleteProveedor: (id) => remove("proveedores", id),
  getMensajes: () => getAll("mensajes"),
  createMensaje: (payload) => create("mensajes", payload),
  updateMensaje: (id, payload) => update("mensajes", id, payload),
  deleteMensaje: (id) => remove("mensajes", id)
};

export const {
  getUsuarios, createUsuario, updateUsuario, deleteUsuario,
  getSesiones, createSesion, updateSesion, deleteSesion,
  getBusquedas, createBusqueda, updateBusqueda, deleteBusqueda,
  getSolicitudes, createSolicitud, updateSolicitud, deleteSolicitud,
  getProveedores, createProveedor, updateProveedor, deleteProveedor,
  getMensajes, createMensaje, updateMensaje, deleteMensaje
} = api;
