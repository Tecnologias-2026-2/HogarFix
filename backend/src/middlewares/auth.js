import { getUserProfile, verifyFirebaseIdToken } from "../config/firebase-admin.js";

const VALID_ROLES = new Set(["Cliente", "Proveedor"]);
const INVALID_TOKEN_CODES = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/tenant-id-mismatch",
  "auth/user-disabled",
  "auth/user-not-found",
]);

function sendUnauthorized(response) {
  return response.status(401).json({
    status: "error",
    code: "UNAUTHENTICATED",
    message: "Se requiere un token de Firebase válido y vigente.",
  });
}

function sendForbidden(response) {
  return response.status(403).json({
    status: "error",
    code: "FORBIDDEN",
    message: "El usuario no tiene permiso para acceder a este recurso.",
  });
}

function sendAuthUnavailable(response) {
  return response.status(503).json({
    status: "error",
    code: "AUTH_UNAVAILABLE",
    message: "No se pudo validar la sesión en este momento.",
  });
}

export function authenticate({
  verifyIdToken = verifyFirebaseIdToken,
  loadUserProfile = getUserProfile,
} = {}) {
  if (typeof verifyIdToken !== "function" || typeof loadUserProfile !== "function") {
    throw new TypeError("Se requieren verificadores de token y perfil.");
  }

  return async function authenticateRequest(request, response, next) {
    const authorization = request.get("authorization") || "";
    const tokenMatch = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!tokenMatch) return sendUnauthorized(response);

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(tokenMatch[1], true);
    } catch (error) {
      if (INVALID_TOKEN_CODES.has(error?.code)) return sendUnauthorized(response);
      console.error("Firebase ID token verification failed:", error?.code || "unknown");
      return sendAuthUnavailable(response);
    }

    if (!decodedToken || typeof decodedToken.uid !== "string" || !decodedToken.uid) {
      return sendUnauthorized(response);
    }

    let profile;
    try {
      profile = await loadUserProfile(decodedToken.uid);
    } catch (error) {
      console.error("Authenticated profile lookup failed:", error?.code || "unknown");
      return sendAuthUnavailable(response);
    }

    const emailMatches =
      typeof decodedToken.email === "string"
      && typeof profile?.email === "string"
      && decodedToken.email.trim().toLowerCase() === profile.email.trim().toLowerCase();
    if (!VALID_ROLES.has(profile?.role) || !emailMatches) return sendForbidden(response);

    request.auth = Object.freeze({
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: profile.role,
    });
    request.isAdmin = decodedToken.admin === true;
    return next();
  };
}

export function requireRole(...roles) {
  if (!roles.length || roles.some((role) => !VALID_ROLES.has(role))) {
    throw new TypeError("Indica uno o más roles permitidos: Cliente o Proveedor.");
  }

  return function authorizeRole(request, response, next) {
    if (!request.auth) return sendUnauthorized(response);
    if (!roles.includes(request.auth.role)) return sendForbidden(response);
    return next();
  };
}

export function requireAdmin() {
  return function authorizeAdmin(request, response, next) {
    if (!request.auth) return sendUnauthorized(response);
    if (request.isAdmin !== true) return sendForbidden(response);
    return next();
  };
}
