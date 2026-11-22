import express from "express";
import { authenticate, requireRole } from "../middlewares/auth.js";
import { createRequestControllers } from "../controllers/request-controller.js";

export function createRequestsRouter(authDependencies, requestService) {
  const router = express.Router();
  const authenticateRequest = authenticate(authDependencies);
  const controllers = createRequestControllers(requestService);

  router.use(authenticateRequest);

  router.post(
    "/solicitudes",
    requireRole("Cliente"),
    controllers.createClientRequest,
  );
  router.get(
    "/solicitudes",
    requireRole("Cliente"),
    controllers.listClientRequests,
  );
  router.get(
    "/solicitudes/:id",
    requireRole("Cliente"),
    controllers.getClientRequest,
  );
  router.patch(
    "/solicitudes/:id/confirmar",
    requireRole("Cliente"),
    controllers.confirmClientRequest,
  );
  router.patch(
    "/solicitudes/:id/cancelar",
    requireRole("Cliente"),
    controllers.cancelClientRequest,
  );
  router.get(
    "/solicitudes/:id/calificacion",
    requireRole("Cliente"),
    controllers.getClientRequestRating,
  );
  router.post(
    "/solicitudes/:id/calificacion",
    requireRole("Cliente"),
    controllers.createClientRating,
  );
  router.get(
    "/provider/:uid/calificaciones",
    requireRole("Cliente", "Proveedor"),
    controllers.listProviderRatings,
  );

  router.get(
    "/provider/solicitudes",
    requireRole("Proveedor"),
    controllers.listProviderRequests,
  );
  router.get(
    "/provider/solicitudes/:id",
    requireRole("Proveedor"),
    controllers.getProviderRequest,
  );
  router.patch(
    "/provider/solicitudes/:id/aceptar",
    requireRole("Proveedor"),
    controllers.acceptProviderRequest,
  );
  router.patch(
    "/provider/solicitudes/:id/rechazar",
    requireRole("Proveedor"),
    controllers.rejectProviderRequest,
  );
  router.patch(
    "/provider/solicitudes/:id/iniciar",
    requireRole("Proveedor"),
    controllers.startProviderRequest,
  );
  router.patch(
    "/provider/solicitudes/:id/completar",
    requireRole("Proveedor"),
    controllers.completeProviderRequest,
  );

  return router;
}
