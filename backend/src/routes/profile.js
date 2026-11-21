import express from "express";
import { authenticate, requireRole } from "../middlewares/auth.js";
import {
  getMyProfile,
  getProviderEligibility,
  getProviderProfile,
  updateMyProfile,
  updateProviderProfile,
} from "../controllers/profile-controller.js";

export function createProfileRouter(authDependencies, profileService) {
  const router = express.Router();
  const authenticateRequest = authenticate(authDependencies);

  router.get("/profile/me", authenticateRequest, getMyProfile(profileService));
  router.patch("/profile/me", authenticateRequest, updateMyProfile(profileService));
  router.get(
    "/provider/profile/me",
    authenticateRequest,
    requireRole("Proveedor"),
    getProviderProfile(profileService),
  );
  router.patch(
    "/provider/profile/me",
    authenticateRequest,
    requireRole("Proveedor"),
    updateProviderProfile(profileService),
  );
  router.get(
    "/provider/eligibility",
    authenticateRequest,
    requireRole("Proveedor"),
    getProviderEligibility(profileService),
  );

  return router;
}