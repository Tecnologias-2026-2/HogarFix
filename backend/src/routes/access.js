import express from "express";
import { authenticate, requireRole } from "../middlewares/auth.js";

function sendAuthenticatedIdentity(request, response) {
  response.status(200).json({
    status: "ok",
    user: request.auth,
  });
}

export function createAccessRouter(authDependencies) {
  const router = express.Router();
  const authenticateRequest = authenticate(authDependencies);

  router.get("/client/me", authenticateRequest, requireRole("Cliente"), sendAuthenticatedIdentity);
  router.get(
    "/provider/me",
    authenticateRequest,
    requireRole("Proveedor"),
    sendAuthenticatedIdentity,
  );

  return router;
}
