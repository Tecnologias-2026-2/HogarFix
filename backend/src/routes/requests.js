
import express from "express";
import { authenticate, requireRole } from "../middlewares/auth.js";
import { createRequestControllers } from "../controllers/request-controller.js";
import { validate } from "../middlewares/validate.js";
import { validateCreateRequest } from "../services/request-validation.js";

export function createRequestsRouter(authDependencies, requestService) {
  const router = express.Router();
  const authenticateRequest = authenticate(authDependencies);
  const controllers = createRequestControllers(requestService);

  router.post(
    "/solicitudes",
    authenticateRequest,
    requireRole("Cliente"),
    validate((body) => validateCreateRequest(body)),
    controllers.createClientRequest,
  );


  router.get(
    "/solicitudes",
    authenticateRequest,
    requireRole("Cliente"),
    controllers.listClientRequests,
  );
  router.get(
    "/solicitudes/:id",
    authenticateRequest,
    requireRole("Cliente"),
    controllers.getClientRequest,
  );
  router.patch(
    "/solicitudes/:id/confirmar",
    authenticateRequest,
    requireRole("Cliente"),
    controllers.confirmClientRequest,
  );
  router.patch(
    "/solicitudes/:id/cancelar",
    authenticateRequest,
    requireRole("Cliente"),
    controllers.cancelClientRequest,
  );
  router.get(
    "/solicitudes/:id/calificacion",
    authenticateRequest,
    requireRole("Cliente"),
    controllers.getClientRequestRating,
  );
  router.post(
    "/solicitudes/:id/calificacion",
    authenticateRequest,
    requireRole("Cliente"),
    controllers.createClientRating,
  );
  // Chat de la solicitud: cliente y proveedor usan la misma ruta; el servicio
  // verifica que el usuario sea participante de esa solicitud.
  router.get(
    "/solicitudes/:id/mensajes",
    authenticateRequest,
    requireRole("Cliente", "Proveedor"),
    controllers.listRequestMessages,
  );
  router.post(
    "/solicitudes/:id/mensajes",
    authenticateRequest,
    requireRole("Cliente", "Proveedor"),
    controllers.sendRequestMessage,
  );
  router.get(
    "/provider/:uid/calificaciones",
    authenticateRequest,
    requireRole("Cliente", "Proveedor"),
    controllers.listProviderRatings,
  );

  router.get(
    "/provider/solicitudes",
    authenticateRequest,
    requireRole("Proveedor"),
    controllers.listProviderRequests,
  );
  router.get(
    "/provider/solicitudes/:id",
    authenticateRequest,
    requireRole("Proveedor"),
    controllers.getProviderRequest,
  );
  router.patch(
    "/provider/solicitudes/:id/aceptar",
    authenticateRequest,
    requireRole("Proveedor"),
    controllers.acceptProviderRequest,
  );
  router.patch(
    "/provider/solicitudes/:id/rechazar",
    authenticateRequest,
    requireRole("Proveedor"),
    controllers.rejectProviderRequest,
  );
  router.patch(
    "/provider/solicitudes/:id/iniciar",
    authenticateRequest,
    requireRole("Proveedor"),
    controllers.startProviderRequest,
  );
  router.patch(
    "/provider/solicitudes/:id/completar",
    authenticateRequest,
    requireRole("Proveedor"),
    controllers.completeProviderRequest,
  );

  return router;
}
