import express from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { updateProviderApproval } from "../controllers/admin-controller.js";

export function createAdminRouter(authDependencies, profileService) {
  const router = express.Router();
  const authenticateRequest = authenticate(authDependencies);

  router.patch(
    "/admin/providers/:uid/approval",
    authenticateRequest,
    requireAdmin(),
    updateProviderApproval(profileService),
  );

  return router;
}