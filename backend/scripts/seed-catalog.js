import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId || process.env.CONFIRM_FIREBASE_PROJECT_ID !== projectId) {
  throw new Error("Define FIREBASE_PROJECT_ID y CONFIRM_FIREBASE_PROJECT_ID con el mismo proyecto antes de sembrar datos.");
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const auth = getAuth(app);
const categories = [
  { id: "plomeria", name: "Plomería", description: "Reparación de fugas, grifos y tuberías.", fixedPriceCOP: 35000, durationMinutes: 60 },
  { id: "electricidad", name: "Electricidad", description: "Instalaciones, enchufes y luminarias.", fixedPriceCOP: 40000, durationMinutes: 60 },
  { id: "jardineria", name: "Jardinería", description: "Poda, mantenimiento y cuidado del jardín.", fixedPriceCOP: 40000, durationMinutes: 90 },
  { id: "aseo-general", name: "Aseo general", description: "Aseo del hogar y labores de cuidado.", fixedPriceCOP: 35000, durationMinutes: 120 },
];

for (const category of categories) {
  const { id, ...data } = category;
  const reference = db.collection("categories").doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) await reference.create({ ...data, active: true, createdAt: new Date() });
  else if (snapshot.get("name") !== data.name || snapshot.get("fixedPriceCOP") !== data.fixedPriceCOP) {
    throw new Error(`La categoría ${id} ya existe con datos distintos; revísala manualmente.`);
  }
}

let associations = [];
if (process.env.PROVIDER_CATALOG_JSON) {
  associations = JSON.parse(process.env.PROVIDER_CATALOG_JSON);
  if (!Array.isArray(associations)) throw new Error("PROVIDER_CATALOG_JSON debe ser un arreglo JSON.");
}
for (const [index, association] of associations.entries()) {
  const { catalogId, providerUid } = association || {};
  if (typeof catalogId !== "string" || !/^[\w.-]{1,128}$/.test(catalogId) || typeof providerUid !== "string") {
    throw new Error(`La asociación ${index + 1} necesita catalogId y providerUid válidos.`);
  }
  const user = await auth.getUser(providerUid);
  if (user.disabled) throw new Error(`La cuenta ${providerUid} está deshabilitada.`);
  const providerProfile = await db.collection("providerProfiles").doc(providerUid).get();
  if (!providerProfile.exists || providerProfile.get("adminApproval.status") !== "approved") {
    throw new Error(`El proveedor ${providerUid} debe tener el perfil aprobado antes de publicarlo.`);
  }
  const reference = db.collection("providerCatalog").doc(catalogId);
  const snapshot = await reference.get();
  if (snapshot.exists && snapshot.get("providerUid") !== providerUid) {
    throw new Error(`El identificador ${catalogId} ya pertenece a otro proveedor.`);
  }
  if (!snapshot.exists) await reference.create({ providerUid, active: true, createdAt: new Date() });
}

console.log(`Catálogo listo: ${categories.length} categorías; ${associations.length} asociaciones de proveedor procesadas.`);
await app.delete();
