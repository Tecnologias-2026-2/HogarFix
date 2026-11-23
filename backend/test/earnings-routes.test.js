import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createEarningsService } from "../src/services/earnings-service.js";


const identities = {
  "provider-token": {
    uid: "provider-uid",
    email: "provider@example.test"
  },
  "other-provider-token": {
    uid: "other-provider-uid",
    email: "other-provider@example.test"
  },
  "client-token": {
    uid: "client-uid",
    email: "client@example.test"
  }
};

const profiles = {
  "provider-uid": {
    role: "Proveedor",
    email: "provider@example.test"
  },
  "other-provider-uid": {
    role: "Proveedor",
    email: "other-provider@example.test"
  },
  "client-uid": {
    role: "Cliente",
    email: "client@example.test"
  }
};


class MemoryFirestore {
  constructor() {
    this.documents = [];
  }

  seed(id, data) {
    this.documents.push({ id, data });
  }

  collection(name) {
    if (name !== "solicitudes") {
      throw new Error("Colección inesperada");
    }

    return {
      where: (field, operator, value) => {
        assert.equal(field, "providerUid");
        assert.equal(operator, "==");

        return {
          get: async () => ({
            docs: this.documents
              .filter((item) => item.data[field] === value)
              .map((item) => ({
                id: item.id,
                data: () => structuredClone(item.data)
              }))
          })
        };
      }
    };
  }
}

function createTestApp() {
  const db = new MemoryFirestore();
  const earningsService = createEarningsService({ db });

  const app = createApp(
    {
      verifyIdToken: async (token) => {
        const identity = identities[token];

        if (!identity) {
          throw new Error("Token inválido");
        }

        return identity;
      },
      loadUserProfile: async (uid) => profiles[uid] || null
    },
    {
      earningsService
    }
  );

  return { app, db };
}

async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) =>
        error ? reject(error) : resolve()
      );
    });
  }
}

async function request(baseUrl, path, token) {
  return fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

function paid(amountCOP, paidAt) {
  return {
    status: "paid",
    amountCOP,
    paidAt: new Date(paidAt)
  };
}

test("ISSUE 20: suma únicamente pagos confirmados", async () => {
  const { app, db } = createTestApp();

  db.seed("request-1", {
    providerUid: "provider-uid",
    payment: paid(80000, "2026-11-02T12:00:00Z")
  });

  db.seed("request-2", {
    providerUid: "provider-uid",
    payment: {
      status: "pending",
      amountCOP: 60000,
      paidAt: new Date("2026-11-03T12:00:00Z")
    }
  });

  db.seed("request-3", {
    providerUid: "provider-uid",
    payment: paid(120000, "2026-11-10T12:00:00Z")
  });

  await withServer(app, async (baseUrl) => {
    const response = await request(
      baseUrl,
      "/api/provider/earnings",
      "provider-token"
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.status, "ok");
    assert.equal(body.currency, "COP");
    assert.equal(body.totalEarningsCOP, 200000);
    assert.equal(body.paidServicesCount, 2);
  });
});

test("ISSUE 20: los ingresos pertenecen al proveedor autenticado", async () => {
  const { app, db } = createTestApp();

  db.seed("request-1", {
    providerUid: "provider-uid",
    payment: paid(80000, "2026-11-02T12:00:00Z")
  });

  db.seed("request-2", {
    providerUid: "other-provider-uid",
    payment: paid(500000, "2026-11-03T12:00:00Z")
  });

  await withServer(app, async (baseUrl) => {
    const response = await request(
      baseUrl,
      "/api/provider/earnings?providerUid=other-provider-uid",
      "provider-token"
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.totalEarningsCOP, 80000);
    assert.equal(body.paidServicesCount, 1);
  });
});

test("ISSUE 20: permite filtrar ingresos por fechas", async () => {
  const { app, db } = createTestApp();

  db.seed("october", {
    providerUid: "provider-uid",
    payment: paid(50000, "2026-10-20T12:00:00Z")
  });

  db.seed("november", {
    providerUid: "provider-uid",
    payment: paid(90000, "2026-11-15T12:00:00Z")
  });

  db.seed("december", {
    providerUid: "provider-uid",
    payment: paid(70000, "2026-12-05T12:00:00Z")
  });

  await withServer(app, async (baseUrl) => {
    const response = await request(
      baseUrl,
      "/api/provider/earnings?from=2026-11-01&to=2026-11-30",
      "provider-token"
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.totalEarningsCOP, 90000);
    assert.equal(body.paidServicesCount, 1);
  });
});

test("ISSUE 20: genera desglose mensual", async () => {
  const { app, db } = createTestApp();

  db.seed("request-1", {
    providerUid: "provider-uid",
    payment: paid(100000, "2026-10-05T12:00:00Z")
  });

  db.seed("request-2", {
    providerUid: "provider-uid",
    payment: paid(200000, "2026-11-05T12:00:00Z")
  });

  db.seed("request-3", {
    providerUid: "provider-uid",
    payment: paid(50000, "2026-11-15T12:00:00Z")
  });

  await withServer(app, async (baseUrl) => {
    const response = await request(
      baseUrl,
      "/api/provider/earnings/breakdown?period=month",
      "provider-token"
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.deepEqual(body.breakdown, [
      {
        period: "2026-10",
        totalCOP: 100000,
        servicesCount: 1
      },
      {
        period: "2026-11",
        totalCOP: 250000,
        servicesCount: 2
      }
    ]);
  });
});

test("ISSUE 20: rechaza fechas y periodos inválidos", async () => {
  const { app } = createTestApp();

  await withServer(app, async (baseUrl) => {
    const invalidPaths = [
      "/api/provider/earnings?from=2026-02-30",
      "/api/provider/earnings?from=2026-12-01&to=2026-11-01",
      "/api/provider/earnings/breakdown?period=week"
    ];

    for (const path of invalidPaths) {
      const response = await request(
        baseUrl,
        path,
        "provider-token"
      );

      assert.equal(response.status, 400);
    }
  });
});

test("ISSUE 20: impide el acceso a clientes", async () => {
  const { app } = createTestApp();

  await withServer(app, async (baseUrl) => {
    for (const path of [
      "/api/provider/earnings",
      "/api/provider/earnings/breakdown"
    ]) {
      const response = await request(
        baseUrl,
        path,
        "client-token"
      );

      assert.equal(response.status, 403);
    }
  });
});

test("ISSUE 20: devuelve cero cuando no hay pagos confirmados", async () => {
  const { app, db } = createTestApp();

  db.seed("unpaid", {
    providerUid: "provider-uid",
    categorySnapshot: { priceCOP: 100000 },
    status: "Completada"
  });

  await withServer(app, async (baseUrl) => {
    const response = await request(
      baseUrl,
      "/api/provider/earnings",
      "provider-token"
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.totalEarningsCOP, 0);
    assert.equal(body.paidServicesCount, 0);
    assert.deepEqual(body.breakdown, []);
  });
});
