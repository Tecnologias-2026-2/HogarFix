import express from "express";
import { verifyFirebaseIdToken } from "../config/firebase-admin.js";

function unauthorized(response) {
  return response.status(401).json({ status: "error", code: "UNAUTHENTICATED", message: "Se requiere una sesión Firebase válida." });
}
const INVALID_TOKEN_CODES = new Set([
  "auth/argument-error", "auth/id-token-expired", "auth/id-token-revoked",
  "auth/invalid-id-token", "auth/tenant-id-mismatch", "auth/user-disabled",
  "auth/user-not-found",
]);

export function createAuthProfileRouter({ verifyIdToken = verifyFirebaseIdToken } = {}, profileService) {
  const router = express.Router();
  router.post("/auth/profile", async (request, response, next) => {
    const match = /^Bearer\s+([^\s]+)$/i.exec(request.get("authorization") || "");
    if (!match) return unauthorized(response);
    let identity;
    try { identity = await verifyIdToken(match[1], true); }
    catch (error) {
      if (INVALID_TOKEN_CODES.has(error?.code)) return unauthorized(response);
      return response.status(503).json({ status: "error", code: "AUTH_UNAVAILABLE", message: "No se pudo validar la sesión en este momento." });
    }
    if (!identity?.uid || !identity?.email) return unauthorized(response);
    try {
      const profile = await profileService.createInitialProfile({
        uid: identity.uid,
        email: identity.email,
        firstName: request.body?.firstName,
        lastName: request.body?.lastName,
        role: request.body?.role,
      });
      return response.status(201).json({ status: "ok", profile });
    } catch (error) { return next(error); }
  });
  return router;
}
