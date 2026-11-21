import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminApp;

function getAdminApp() {
  if (adminApp) return adminApp;

  adminApp = getApps().find((app) => app.name === "[DEFAULT]");
  if (!adminApp) {
    const options = { credential: applicationDefault() };
    if (process.env.FIREBASE_PROJECT_ID) options.projectId = process.env.FIREBASE_PROJECT_ID;
    adminApp = initializeApp(options);
  }
  return adminApp;
}

export function verifyFirebaseIdToken(token, checkRevoked = true) {
  return getAuth(getAdminApp()).verifyIdToken(token, checkRevoked);
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export async function getUserProfile(uid) {
  const snapshot = await getAdminFirestore().collection("users").doc(uid).get();
  return snapshot.exists ? snapshot.data() : null;
}
