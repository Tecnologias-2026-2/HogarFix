import express from "express";
import { authenticate } from "../middlewares/auth.js";

export function createSupportRouter(authDependencies, service) {
  const router = express.Router();
  router.use(authenticate(authDependencies));
  const handle = (operation, key, status = 200) => async (request, response, next) => {
    try {
      response.status(status).json({ status: "ok", [key]: await operation(request) });
    } catch (error) { next(error); }
  };
  router.get("/notifications", handle((req) => service.listNotifications({ uid: req.auth.uid }), "notifications"));
  router.patch("/notifications/:id/read", handle((req) => service.markNotificationRead({ uid: req.auth.uid, notificationId: req.params.id }), "notification"));
  router.get("/support/faqs", handle(() => service.listFaqs(), "faqs"));
  router.post("/support/messages", handle((req) => service.createSupportMessage({ uid: req.auth.uid, role: req.auth.role, input: req.body }), "message", 201));
  return router;
}
