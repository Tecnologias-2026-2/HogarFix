import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const uid = process.env.ADMIN_UID;
if (!projectId || process.env.CONFIRM_FIREBASE_PROJECT_ID !== projectId) {
  throw new Error("Define FIREBASE_PROJECT_ID y CONFIRM_FIREBASE_PROJECT_ID con el mismo proyecto.");
}
if (!uid || process.env.CONFIRM_ADMIN_UID !== uid) {
  throw new Error("Define ADMIN_UID y CONFIRM_ADMIN_UID con el UID exacto que autorizas como administrador.");
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
console.log(`Claim admin asignado a ${uid} en ${projectId}. El usuario debe renovar su sesión para recibir el claim.`);
await app.delete();
