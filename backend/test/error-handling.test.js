import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

import {
  errorHandler,
  notFoundHandler
} from "../src/middlewares/error-handler.js";

import { validate } from "../src/middlewares/validate.js";

function createTestApp() {
  const app = express();

  app.use(express.json());

  app.post(
    "/validar",
    validate((body) => {
      if (
        !body ||
        typeof body.nombre !== "string" ||
        body.nombre.trim().length < 3
      ) {
        throw Object.assign(
          new Error("El nombre debe tener al menos 3 caracteres."),
          {
            statusCode: 400,
            code: "INVALID_REQUEST"
          }
        );
      }
    }),
    (_request, response) => {
      response.status(200).json({ status: "ok" });
    }
  );

  app.get("/error-interno", () => {
    throw new Error(
      "Firebase private_key=SUPER_SECRET_KEY"
    );
  });

  app.get("/error-falso-400", () => {
    throw Object.assign(
      new Error("password=SUPER_SECRET_PASSWORD"),
      { statusCode: 400 }
    );
  });

  app.get("/firestore-error", () => {
    throw Object.assign(
      new Error("Firestore credentials leaked"),
      {
        statusCode: 503,
        code: "FIRESTORE_UNAVAILABLE"
      }
    );
  });

  app.get("/error-conocido", () => {
    throw Object.assign(
      new Error("La solicitud indicada no es válida."),
      {
        statusCode: 400,
        code: "INVALID_REQUEST_ID"
      }
    );
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function withServer(callback) {
  const server = createTestApp().listen(0);

  try {
    await new Promise((resolve) => {
      if (server.listening) resolve();
      else server.once("listening", resolve);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("ISSUE 21: rechaza datos HTTP inválidos", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Jo" })
    });

    assert.equal(response.status, 400);

    const data = await response.json();
    assert.equal(data.status, "error");
    assert.match(data.message, /nombre/);
  });
});

test("ISSUE 21: acepta datos HTTP válidos", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Juan" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok"
    });
  });
});

test("ISSUE 21: rechaza JSON mal formado", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"nombre":'
    });

    assert.equal(response.status, 400);

    const data = await response.json();
    assert.equal(data.status, "error");
    assert.doesNotMatch(
      JSON.stringify(data),
      /SyntaxError|stack|at JSON.parse/
    );
  });
});

test("ISSUE 21: rutas inexistentes devuelven 404", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/no-existe`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      status: "error",
      message: "Ruta no encontrada"
    });
  });
});

test("ISSUE 21: errores internos no exponen secretos", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/error-interno`);

    assert.equal(response.status, 500);

    const body = await response.text();

    assert.doesNotMatch(
      body,
      /SUPER_SECRET_KEY|private_key|Firebase/
    );
  });
});

test("ISSUE 21: errores 400 desconocidos no exponen datos", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/error-falso-400`);

    assert.equal(response.status, 500);

    const body = await response.text();

    assert.doesNotMatch(
      body,
      /SUPER_SECRET_PASSWORD|password=/
    );
  });
});

test("ISSUE 21: errores Firestore devuelven respuesta segura", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/firestore-error`);

    assert.equal(response.status, 503);

    const body = await response.text();

    assert.doesNotMatch(
      body,
      /credentials leaked|Firestore/
    );
  });
});

test("ISSUE 21: conserva errores de validación conocidos", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/error-conocido`);

    assert.equal(response.status, 400);

    const data = await response.json();

    assert.equal(data.status, "error");
    assert.equal(
      data.message,
      "La solicitud indicada no es válida."
    );
  });
});
