import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

test("GET /api/health responde correctamente", async () => {
  const app = createApp(
    {
      verifyIdToken: async () => ({}),
      getUserProfile: async () => ({}),
    },
    {
      profileService: {},
      requestService: {},
    },
  );

  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/health`,
    );

    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.status, "ok");
    assert.equal(
      data.message,
      "Servidor de HogarFix funcionando correctamente",
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

test("Una ruta inexistente responde 404 en JSON", async () => {
  const app = createApp(
    {
      verifyIdToken: async () => ({}),
      getUserProfile: async () => ({}),
    },
    {
      profileService: {},
      requestService: {},
    },
  );

  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/ruta-inexistente`,
    );

    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.status, "error");
    assert.equal(data.message, "Ruta no encontrada");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
