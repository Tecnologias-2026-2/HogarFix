import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";

const identities = {
  "client-token": { uid: "client-uid", email: "client@example.test" },
  "provider-token": { uid: "provider-uid", email: "provider@example.test" },
};

const profiles = {
  "client-uid": { email: "client@example.test", role: "Cliente" },
  "provider-uid": { email: "provider@example.test", role: "Proveedor" },
};

// Solicitud válida con fecha relativa (pasado mañana, hora de Bogotá): el middleware
// validate usa el reloj real, así que una fecha fija dejaría de ser válida con el tiempo.
function futureDate(days = 2) {
  const bogotaNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
  bogotaNow.setUTCDate(bogotaNow.getUTCDate() + days);
  return bogotaNow.toISOString().slice(0, 10);
}

function validRequestBody(extra = {}) {
  return {
    providerCatalogId: "catalog-1",
    categoryId: "plomeria",
    date: futureDate(),
    time: "10:00",
    address: "Calle 45 #28-10",
    detail: "Reparación de una fuga en el lavaplatos.",
    ...extra,
  };
}

function createRequestServiceMock(overrides = {}) {
  const calls = [];
  const requestService = {
    async createRequest(args) {
      calls.push(["createRequest", args]);
      if (Object.keys(args.input || {}).some((key) => key === "clientUid" || key === "providerUid")) {
        throw Object.assign(new Error("No se permiten UID en el cuerpo."), {
          statusCode: 400,
          code: "PROTECTED_REQUEST_FIELDS",
        });
      }
      return { id: "created-request", clientUid: args.clientUid };
    },
    async listRequests(args) {
      calls.push(["listRequests", args]);
      return [];
    },
    async getRequest(args) {
      calls.push(["getRequest", args]);
      if (args.requestId === "foreign-request") {
        throw Object.assign(new Error("No encontramos esa solicitud."), {
          statusCode: 404,
          code: "REQUEST_NOT_FOUND",
        });
      }
      return { id: args.requestId };
    },
    async transitionRequest(args) {
      calls.push(["transitionRequest", args]);
      if (args.requestId === "foreign-request") {
        throw Object.assign(new Error("No encontramos esa solicitud."), {
          statusCode: 404,
          code: "REQUEST_NOT_FOUND",
        });
      }
      return { id: args.requestId, status: args.action };
    },
  };
  return { calls, requestService: { ...requestService, ...overrides } };
}

function createTestApp({ requestServiceOverrides, supportService } = {}) {
  const { calls, requestService } = createRequestServiceMock(requestServiceOverrides);
  const app = createApp(
    {
      verifyIdToken: async (token) => {
        const identity = identities[token];
        if (!identity) {
          throw Object.assign(new Error("invalid token"), { code: "auth/invalid-id-token" });
        }
        return identity;
      },
      loadUserProfile: async (uid) => profiles[uid] || null,
    },
    { requestService, supportService: supportService || {
      async listNotifications(args) { calls.push(["listNotifications", args]); return []; },
      async markNotificationRead(args) { calls.push(["markNotificationRead", args]); return { id: args.notificationId }; },
      listFaqs() { calls.push(["listFaqs"]); return [{ id: "faq-1" }]; },
      async createSupportMessage(args) { calls.push(["createSupportMessage", args]); return { id: "message-1" }; },
    } },
  );
  return { app, calls };
}

async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function request(baseUrl, path, token, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

test("every private request route rejects a missing token", async () => {
  const privateRoutes = [
    { path: "/api/solicitudes", options: { method: "POST" } },
    { path: "/api/solicitudes" },
    { path: "/api/solicitudes/request-1" },
    { path: "/api/solicitudes/request-1/confirmar", options: { method: "PATCH" } },
    { path: "/api/solicitudes/request-1/cancelar", options: { method: "PATCH" } },
    { path: "/api/provider/solicitudes" },
    { path: "/api/provider/solicitudes/request-1" },
    { path: "/api/provider/solicitudes/request-1/aceptar", options: { method: "PATCH" } },
    { path: "/api/provider/solicitudes/request-1/rechazar", options: { method: "PATCH" } },
    { path: "/api/provider/solicitudes/request-1/iniciar", options: { method: "PATCH" } },
    { path: "/api/provider/solicitudes/request-1/completar", options: { method: "PATCH" } },
  ];
  const { app, calls } = createTestApp();

  await withServer(app, async (baseUrl) => {
    for (const route of privateRoutes) {
      const response = await request(baseUrl, route.path, undefined, route.options);
      assert.equal(response.status, 401, `${route.options?.method || "GET"} ${route.path}`);
      assert.equal((await response.json()).code, "UNAUTHENTICATED");
    }
  });
  assert.deepEqual(calls, []);
});

test("internal service errors return a generic response without leaking details", async () => {
  const sensitiveMessage = "private-firestore-path-and-credentials";
  const { app } = createTestApp({
    requestServiceOverrides: {
      async listRequests() {
        throw new Error(sensitiveMessage);
      },
    },
  });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await withServer(app, async (baseUrl) => {
      const response = await request(baseUrl, "/api/solicitudes", "client-token");
      const body = await response.text();

      assert.equal(response.status, 500);
      assert.equal(body, JSON.stringify({
        status: "error",
        message: "Error interno del servidor.",
      }));
      assert.equal(body.includes(sensitiveMessage), false);
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test("create passes the authenticated UID, never a body UID, to the service", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, "/api/solicitudes", "client-token", {
      method: "POST",
      headers: { "Idempotency-Key": "request-key-000001" },
      body: JSON.stringify(validRequestBody({ clientUid: "forged-client" })),
    });

    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);

    const data = await response.json();
    assert.equal(data.status, "error");

  });
});

test("valid client creation returns 201 and forwards the idempotency key", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, "/api/solicitudes", "client-token", {
      method: "POST",
      headers: { "Idempotency-Key": "request-key-000001" },
      body: JSON.stringify(validRequestBody()),
    });

    assert.equal(response.status, 201);
    assert.equal((await response.json()).request.id, "created-request");
    assert.equal(calls[0][1].clientUid, "client-uid");
    assert.equal(calls[0][1].idempotencyKey, "request-key-000001");
  });
});

test("query UID and role values cannot override the verified client identity", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await request(
      baseUrl,
      "/api/solicitudes?uid=forged-client&role=Proveedor",
      "client-token",
    );
    assert.equal(response.status, 200);
    assert.deepEqual(calls[0], [
      "listRequests",
      { actorUid: "client-uid", actorRole: "Cliente" },
    ]);
  });
});

test("client detail and provider list/detail use authenticated identities", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const clientDetail = await request(
      baseUrl,
      "/api/solicitudes/own-request",
      "client-token",
    );
    const providerList = await request(
      baseUrl,
      "/api/provider/solicitudes?uid=forged-provider",
      "provider-token",
    );
    const providerDetail = await request(
      baseUrl,
      "/api/provider/solicitudes/own-request?uid=forged-provider",
      "provider-token",
    );

    assert.equal(clientDetail.status, 200);
    assert.equal(providerList.status, 200);
    assert.equal(providerDetail.status, 200);
    assert.deepEqual(calls.map(([name, args]) => [name, args.actorUid, args.actorRole]), [
      ["getRequest", "client-uid", "Cliente"],
      ["listRequests", "provider-uid", "Proveedor"],
      ["getRequest", "provider-uid", "Proveedor"],
    ]);
  });
});

test("each role is rejected from the other role's request routes", async () => {
  const clientRoutes = [
    { path: "/api/solicitudes", options: { method: "POST" } },
    { path: "/api/solicitudes" },
    { path: "/api/solicitudes/request-1" },
    { path: "/api/solicitudes/request-1/confirmar", options: { method: "PATCH" } },
    { path: "/api/solicitudes/request-1/cancelar", options: { method: "PATCH" } },
  ];
  const providerRoutes = [
    { path: "/api/provider/solicitudes" },
    { path: "/api/provider/solicitudes/request-1" },
    { path: "/api/provider/solicitudes/request-1/aceptar", options: { method: "PATCH" } },
    { path: "/api/provider/solicitudes/request-1/rechazar", options: { method: "PATCH" } },
    { path: "/api/provider/solicitudes/request-1/iniciar", options: { method: "PATCH" } },
    { path: "/api/provider/solicitudes/request-1/completar", options: { method: "PATCH" } },
  ];
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    for (const route of clientRoutes) {
      const response = await request(baseUrl, route.path, "provider-token", route.options);
      assert.equal(response.status, 403, `${route.options?.method || "GET"} ${route.path}`);
    }
    for (const route of providerRoutes) {
      const response = await request(baseUrl, route.path, "client-token", route.options);
      assert.equal(response.status, 403, `${route.options?.method || "GET"} ${route.path}`);
    }
    assert.deepEqual(calls, []);
  });
});

test("foreign request details return the service 404 and use the authenticated UID", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await request(
      baseUrl,
      "/api/solicitudes/foreign-request?uid=other-client",
      "client-token",
    );
    assert.equal(response.status, 404);
    assert.deepEqual(calls[0], [
      "getRequest",
      {
        requestId: "foreign-request",
        actorUid: "client-uid",
        actorRole: "Cliente",
      },
    ]);
  });
});

test("provider transitions map to explicit service actions and authenticated identity", async () => {
  const actions = [
    ["aceptar", "accept"],
    ["rechazar", "reject"],
    ["iniciar", "start"],
    ["completar", "complete"],
  ];
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    for (const [pathAction, serviceAction] of actions) {
      const response = await request(
        baseUrl,
        `/api/provider/solicitudes/request-1/${pathAction}`,
        "provider-token",
        { method: "PATCH" },
      );
      assert.equal(response.status, 200);
      assert.deepEqual(calls.at(-1), [
        "transitionRequest",
        {
          requestId: "request-1",
          actorUid: "provider-uid",
          actorRole: "Proveedor",
          action: serviceAction,
        },
      ]);
    }
  });
});

test("client confirmation and cancellation use the verified identity", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    for (const [pathAction, serviceAction] of [
      ["confirmar", "confirm"],
      ["cancelar", "cancel"],
    ]) {
      const response = await request(
        baseUrl,
        `/api/solicitudes/request-1/${pathAction}`,
        "client-token",
        { method: "PATCH" },
      );
      assert.equal(response.status, 200);
      assert.deepEqual(calls.at(-1), [
        "transitionRequest",
        {
          requestId: "request-1",
          actorUid: "client-uid",
          actorRole: "Cliente",
          action: serviceAction,
        },
      ]);
    }
  });
});

test("unauthorized and foreign-request actions do not succeed", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const wrongRole = await request(
      baseUrl,
      "/api/provider/solicitudes/request-1/aceptar",
      "client-token",
      { method: "PATCH" },
    );
    const foreign = await request(
      baseUrl,
      "/api/provider/solicitudes/foreign-request/aceptar",
      "provider-token",
      { method: "PATCH" },
    );

    assert.equal(wrongRole.status, 403);
    assert.equal(foreign.status, 404);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].actorUid, "provider-uid");
  });
});

test("CORS permits authenticated POST requests with the idempotency header", async () => {
  const previousOrigins = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = "https://frontend.example.test";
  try {
    const { app } = createTestApp();
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/solicitudes`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://frontend.example.test",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
        },
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("access-control-allow-origin"), "https://frontend.example.test");
      assert.match(response.headers.get("access-control-allow-methods"), /POST/);
      assert.match(response.headers.get("access-control-allow-headers"), /idempotency-key/i);
    });
  } finally {
    if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
  }
});

test("support and notification endpoints are authenticated and use the verified UID", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    assert.equal((await request(baseUrl, "/api/notifications", "client-token")).status, 200);
    assert.equal((await request(baseUrl, "/api/notifications/notice-1/read", "client-token", { method: "PATCH" })).status, 200);
    assert.equal((await request(baseUrl, "/api/support/faqs", "provider-token")).status, 200);
    const sent = await request(baseUrl, "/api/support/messages", "provider-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Ayuda con mi cuenta", message: "Necesito ayuda para actualizar mi perfil." }),
    });
    assert.equal(sent.status, 201);
    assert.deepEqual(calls, [
      ["listNotifications", { uid: "client-uid" }],
      ["markNotificationRead", { uid: "client-uid", notificationId: "notice-1" }],
      ["listFaqs"],
      ["createSupportMessage", { uid: "provider-uid", role: "Proveedor", input: { subject: "Ayuda con mi cuenta", message: "Necesito ayuda para actualizar mi perfil." } }],
    ]);
    assert.equal((await request(baseUrl, "/api/support/faqs", "invalid")).status, 401);
  });
});

test("publica los errores de dominio con su estado 4xx y código", async () => {
  const conflict = Object.assign(new Error("El horario ya no está disponible."), {
    statusCode: 409,
    code: "PROVIDER_SCHEDULE_CONFLICT",
  });
  const { app } = createTestApp({ requestServiceOverrides: { async createRequest() { throw conflict; } } });
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, "/api/solicitudes", "client-token", {
      method: "POST",
      headers: { "Idempotency-Key": "request-key-000001" },
      body: JSON.stringify(validRequestBody()),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "PROVIDER_SCHEDULE_CONFLICT");
  });
});

test("conserva 503 para errores de Firebase en vez de convertirlos a 500", async () => {
  const unavailable = Object.assign(new Error("Firestore unavailable"), {
    statusCode: 503,
    code: "FIRESTORE_UNAVAILABLE",
  });
  const { app } = createTestApp({ requestServiceOverrides: { async createRequest() { throw unavailable; } } });
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, "/api/solicitudes", "client-token", {
      method: "POST",
      headers: { "Idempotency-Key": "request-key-000001" },
      body: JSON.stringify(validRequestBody()),
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).message, /temporalmente no disponible/i);
  });
});
