import express from "express";
import { authenticate, requireRole } from "../middlewares/auth.js";
import {
  getMyProfile,
  getProviderEligibility,
  getProviderProfile,
  updateMyProfile,
  updateProviderProfile,
  getProviderSpecialties,
  updateProviderSpecialties,
  getProviderAvailability,
  updateProviderAvailability,
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

  router.get(
    "/provider/especialidades",
    authenticateRequest,
    requireRole("Proveedor"),
    getProviderSpecialties(profileService),
  );

  router.patch(
    "/provider/especialidades",
    authenticateRequest,
    requireRole("Proveedor"),
    updateProviderSpecialties(profileService),
  );

  router.get(
    "/provider/disponibilidad",
    authenticateRequest,
    requireRole("Proveedor"),
    getProviderAvailability(profileService),
  );

  router.patch(
    "/provider/disponibilidad",
    authenticateRequest,
    requireRole("Proveedor"),
    updateProviderAvailability(profileService),
  );

  return router;
}
