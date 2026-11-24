import express from "express";
import { authenticate, requireRole } from "../middlewares/auth.js";
import {
  getProviderEarnings,
  getProviderEarningsBreakdown
} from "../controllers/earnings-controller.js";

export function createEarningsRouter(authDependencies, earningsService) {
  const router = express.Router();
  const authenticateRequest = authenticate(authDependencies);

  router.get(
    "/provider/earnings",
    authenticateRequest,
    requireRole("Proveedor"),
    getProviderEarnings(earningsService)
  );

  router.get(
    "/provider/earnings/breakdown",
    authenticateRequest,
    requireRole("Proveedor"),
    getProviderEarningsBreakdown(earningsService)
  );

  return router;
}
