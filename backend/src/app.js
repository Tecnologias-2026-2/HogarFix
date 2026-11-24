import express from "express";
import cors from "cors";
import { createAccessRouter } from "./routes/access.js";
import { createAdminRouter } from "./routes/admin.js";
import { createProfileRouter } from "./routes/profile.js";
import { createRequestsRouter } from "./routes/requests.js";
import { createSupportRouter } from "./routes/support.js";
import { createCatalogRouter } from "./routes/catalog.js";
import { createAuthProfileRouter } from "./routes/auth-profile.js";
import { createCatalogService } from "./services/catalog-service.js";
import { createProfileService } from "./services/profile-service.js";
import { createRequestService } from "./services/request-service.js";
import { createSupportService } from "./services/support-service.js";
import { createEarningsRouter } from "./routes/earnings.js";
import { createEarningsService } from "./services/earnings-service.js";
import {
  notFoundHandler,
  errorHandler
} from "./middlewares/error-handler.js";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://tecnologias-2026-2.github.io",
];

function getAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(configuredOrigins?.length ? configuredOrigins : DEFAULT_CORS_ORIGINS);
}

export function createApp(
  authDependencies = {},
  { profileService, requestService, supportService, catalogService, earningsService } = {},
) {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        const error = new Error("Origin not allowed.");
        error.statusCode = 403;
        return callback(error);
      },
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    }),
  );
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      message: "Servidor de HogarFix funcionando correctamente",
    });
  });

  app.use("/api", createAccessRouter(authDependencies));
  const profiles = profileService || createProfileService();
  app.use("/api", createAuthProfileRouter(authDependencies, profiles));
  app.use("/api", createProfileRouter(authDependencies, profiles));
  app.use("/api", createAdminRouter(authDependencies, profiles));
  const requests = requestService || createRequestService({ profileService: profiles });
  app.use("/api", createCatalogRouter(catalogService || createCatalogService({ profileService: profiles, requestService: requests })));
  app.use("/api", createRequestsRouter(authDependencies, requests));
  const earnings = earningsService || createEarningsService();
  app.use("/api", createEarningsRouter(authDependencies, earnings));
  app.use("/api", createSupportRouter(authDependencies, supportService || createSupportService()));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
