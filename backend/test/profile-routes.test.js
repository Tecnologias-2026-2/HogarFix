import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createProfileService } from "../src/services/profile-service.js";

const identities = {
  "client-token": { uid: "client-uid", email: "client@example.test" },
  "provider-token": { uid: "provider-uid", email: "provider@example.test" },
  "admin-token": { uid: "admin-uid", email: "admin@example.test", admin: true },
};

const userProfiles = {
  "client-uid": { email: "client@example.test", role: "Cliente", firstName: "Ana", lastName: "Pérez" },
  "provider-uid": {
    email: "provider@example.test",
    role: "Proveedor",
    firstName: "Carmen",
    lastName: "Díaz",
  },
  "admin-uid": { email: "admin@example.test", role: "Cliente", firstName: "Admin", lastName: "Fix" },
};

function clone(value) {
  return structuredClone(value);
}

class MemoryDocumentReference {
  constructor(store, collection, id) {
    this.store = store;
    this.collectionName = collection;
    this.id = id;
  }

  get key() {
    return `${this.collectionName}/${this.id}`;
  }

  async get() {
    const data = this.store.get(this.key);
    return { exists: data !== undefined, data: () => clone(data) };
  }

  async update(values) {
    const data = this.store.get(this.key);
    if (!data) throw Object.assign(new Error("not found"), { code: "not-found" });
    this.store.set(this.key, { ...data, ...clone(values) });
  }
}

class MemoryFirestore {
  constructor() {
    this.store = new Map();
  }

  collection(name) {
    return {
      doc: (id) => new MemoryDocumentReference(this.store, name, id),
    };
  }

  seed(collection, id, data) {
    this.store.set(`${collection}/${id}`, clone(data));
  }

  read(collection, id) {
    return clone(this.store.get(`${collection}/${id}`));
  }

  async runTransaction(operation) {
    const writes = [];
    const transaction = {
      get: (reference) => reference.get(),
      set: (reference, data, options = {}) => writes.push({ reference, data, merge: options.merge }),
    };
    const result = await operation(transaction);
    writes.forEach(({ reference, data, merge }) => {
      const current = this.store.get(reference.key);
      this.store.set(reference.key, merge && current ? { ...current, ...clone(data) } : clone(data));
    });
    return result;
  }
}

function createTestApp() {
  const db = new MemoryFirestore();
  Object.entries(userProfiles).forEach(([uid, profile]) => db.seed("users", uid, profile));
  const accounts = new Map([
    ["provider-uid", { disabled: false }],
    ["admin-uid", { disabled: false }],
  ]);
  const auth = {
    async getUser(uid) {
      const account = accounts.get(uid);
      if (!account) throw Object.assign(new Error("not found"), { code: "auth/user-not-found" });
      return account;
    },
  };
  const profileService = createProfileService({ db, auth, now: () => new Date("2026-03-01T12:00:00.000Z") });
  const app = createApp(
    {
      verifyIdToken: async (token) => {
        const identity = identities[token];
        if (!identity) throw Object.assign(new Error("invalid token"), { code: "auth/invalid-id-token" });
        return identity;
      },
      loadUserProfile: async (uid) => userProfiles[uid] || null,
    },
    { profileService },
  );
  return { app, db, accounts };
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
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

const completeProviderProfile = {
  bio: "Profesional con experiencia en servicios confiables para el hogar.",
  experienceYears: 5,
  coverageZone: "Bogotá",
  availability: "Lunes a sábado",
  services: ["plomeria", "electricidad"],
};

test("personal profile is scoped to the token UID and rejects protected fields", async () => {
  const { app, db } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const ownProfile = await request(baseUrl, "/api/profile/me?uid=provider-uid", "client-token");
    assert.equal(ownProfile.status, 200);
    assert.equal((await ownProfile.json()).profile.uid, "client-uid");

    const protectedUpdate = await request(baseUrl, "/api/profile/me", "client-token", {
      method: "PATCH",
      body: JSON.stringify({ role: "Proveedor", email: "attacker@example.test" }),
    });
    assert.equal(protectedUpdate.status, 400);

    const invalidPhone = await request(baseUrl, "/api/profile/me", "client-token", {
      method: "PATCH",
      body: JSON.stringify({ phone: "---------" }),
    });
    assert.equal(invalidPhone.status, 400);

    const update = await request(baseUrl, "/api/profile/me", "client-token", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "Ana María", phone: "+57 300 555 55 55" }),
    });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).profile.firstName, "Ana María");
    assert.equal(db.read("users", "provider-uid").firstName, "Carmen");
    assert.equal(db.read("users", "client-uid").role, "Cliente");
  });
});

test("provider can save an incomplete profile without receiving approval", async () => {
  const { app, db } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const update = await request(baseUrl, "/api/provider/profile/me", "provider-token", {
      method: "PATCH",
      body: JSON.stringify({ coverageZone: "Bogotá" }),
    });
    assert.equal(update.status, 200);
    const { profile } = await update.json();
    assert.equal(profile.uid, "provider-uid");
    assert.equal(profile.profileComplete, false);
    assert.equal(profile.adminApproval.status, "pending");
    assert.equal(db.read("providerProfiles", "provider-uid").coverageZone, "Bogotá");

    const approval = await request(
      baseUrl,
      "/api/admin/providers/provider-uid/approval",
      "admin-token",
      { method: "PATCH", body: JSON.stringify({ status: "approved" }) },
    );
    assert.equal(approval.status, 409);
  });
});

test("provider updates validate input, protect approval, and reset approval after changes", async () => {
  const { app, db } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const invalid = await request(baseUrl, "/api/provider/profile/me", "provider-token", {
      method: "PATCH",
      body: JSON.stringify({ services: ["servicio-inventado"] }),
    });
    assert.equal(invalid.status, 400);

    const protectedUpdate = await request(baseUrl, "/api/provider/profile/me", "provider-token", {
      method: "PATCH",
      body: JSON.stringify({ adminApproval: { status: "approved" } }),
    });
    assert.equal(protectedUpdate.status, 400);

    const complete = await request(baseUrl, "/api/provider/profile/me", "provider-token", {
      method: "PATCH",
      body: JSON.stringify(completeProviderProfile),
    });
    assert.equal(complete.status, 200);
    const completeProfile = (await complete.json()).profile;
    assert.equal(completeProfile.automaticValidation.status, "passed");
    assert.equal(completeProfile.adminApproval.status, "pending");

    db.seed("providerProfiles", "provider-uid", {
      ...db.read("providerProfiles", "provider-uid"),
      adminApproval: { status: "approved", reviewedBy: "admin-uid", reviewedAt: "earlier" },
    });
    const edited = await request(baseUrl, "/api/provider/profile/me", "provider-token", {
      method: "PATCH",
      body: JSON.stringify({ coverageZone: "Bogotá y alrededores" }),
    });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).profile.adminApproval.status, "pending");
  });
});

test("only an administrator claim can approve a complete, active provider", async () => {
  const { app, db, accounts } = createTestApp();
  await withServer(app, async (baseUrl) => {
    await request(baseUrl, "/api/provider/profile/me", "provider-token", {
      method: "PATCH",
      body: JSON.stringify(completeProviderProfile),
    });

    const denied = await request(
      baseUrl,
      "/api/admin/providers/provider-uid/approval",
      "provider-token",
      { method: "PATCH", body: JSON.stringify({ status: "approved" }) },
    );
    assert.equal(denied.status, 403);

    const selfApproval = await request(
      baseUrl,
      "/api/admin/providers/admin-uid/approval",
      "admin-token",
      { method: "PATCH", body: JSON.stringify({ status: "approved" }) },
    );
    assert.equal(selfApproval.status, 403);

    const approved = await request(
      baseUrl,
      "/api/admin/providers/provider-uid/approval",
      "admin-token",
      { method: "PATCH", body: JSON.stringify({ status: "approved" }) },
    );
    assert.equal(approved.status, 200);
    assert.equal((await approved.json()).profile.adminApproval.reviewedBy, "admin-uid");

    const eligibility = await request(baseUrl, "/api/provider/eligibility", "provider-token");
    assert.equal((await eligibility.json()).eligibility.eligible, true);

    accounts.set("provider-uid", { disabled: true });
    const disabledEligibility = await request(
      baseUrl,
      "/api/provider/eligibility",
      "provider-token",
    );
    assert.equal((await disabledEligibility.json()).eligibility.eligible, false);

    const disabledApproval = await request(
      baseUrl,
      "/api/admin/providers/provider-uid/approval",
      "admin-token",
      { method: "PATCH", body: JSON.stringify({ status: "approved" }) },
    );
    assert.equal(disabledApproval.status, 409);
  });
});

test("profile routes reject the wrong role and never resolve a provider by query UID", async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const wrongRole = await request(
      baseUrl,
      "/api/provider/profile/me?uid=provider-uid",
      "client-token",
    );
    assert.equal(wrongRole.status, 403);

    const ownProfile = await request(
      baseUrl,
      "/api/provider/profile/me?uid=client-uid",
      "provider-token",
    );
    assert.equal(ownProfile.status, 200);
    assert.equal((await ownProfile.json()).profile.uid, "provider-uid");
  });
});

test("configured frontend origin can preflight authenticated profile updates", async () => {
  const previousOrigins = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = "https://frontend.example.test";
  try {
    const { app } = createTestApp();
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/profile/me`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://frontend.example.test",
          "Access-Control-Request-Method": "PATCH",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      });
      assert.equal(response.status, 204);
      assert.equal(
        response.headers.get("access-control-allow-origin"),
        "https://frontend.example.test",
      );
    });
  } finally {
    if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
  }
});

test("ISSUE 19: provider can update and consult specialties", async () => {
  const { app, db } = createTestApp();

  await withServer(app, async (baseUrl) => {
    const update = await request(
      baseUrl,
      "/api/provider/especialidades?uid=client-uid",
      "provider-token",
      {
        method: "PATCH",
        body: JSON.stringify({
          services: ["plomeria", "electricidad"],
        }),
      },
    );

    assert.equal(update.status, 200);
    assert.deepEqual((await update.json()).services, [
      "plomeria",
      "electricidad",
    ]);

    const saved = db.read("providerProfiles", "provider-uid");
    assert.deepEqual(saved.services, ["plomeria", "electricidad"]);
    assert.equal(db.read("providerProfiles", "client-uid"), undefined);

    const consult = await request(
      baseUrl,
      "/api/provider/especialidades",
      "provider-token",
    );

    assert.equal(consult.status, 200);
    assert.deepEqual((await consult.json()).services, [
      "plomeria",
      "electricidad",
    ]);
  });
});

test("ISSUE 19: provider can update and consult availability", async () => {
  const { app, db } = createTestApp();

  await withServer(app, async (baseUrl) => {
    const update = await request(
      baseUrl,
      "/api/provider/disponibilidad",
      "provider-token",
      {
        method: "PATCH",
        body: JSON.stringify({
          availability: "Lunes a viernes de 8:00 a 17:00",
        }),
      },
    );

    assert.equal(update.status, 200);
    assert.equal(
      (await update.json()).availability,
      "Lunes a viernes de 8:00 a 17:00",
    );

    assert.equal(
      db.read("providerProfiles", "provider-uid").availability,
      "Lunes a viernes de 8:00 a 17:00",
    );

    const consult = await request(
      baseUrl,
      "/api/provider/disponibilidad",
      "provider-token",
    );

    assert.equal(consult.status, 200);
    assert.equal(
      (await consult.json()).availability,
      "Lunes a viernes de 8:00 a 17:00",
    );
  });
});

test("ISSUE 19: specialties and availability enforce validation and permissions", async () => {
  const { app, db } = createTestApp();

  await withServer(app, async (baseUrl) => {
    const clientUpdate = await request(
      baseUrl,
      "/api/provider/especialidades",
      "client-token",
      {
        method: "PATCH",
        body: JSON.stringify({ services: ["plomeria"] }),
      },
    );

    assert.equal(clientUpdate.status, 403);

    const clientRead = await request(
      baseUrl,
      "/api/provider/disponibilidad",
      "client-token",
    );

    assert.equal(clientRead.status, 403);

    const invalidServices = await request(
      baseUrl,
      "/api/provider/especialidades",
      "provider-token",
      {
        method: "PATCH",
        body: JSON.stringify({ services: ["categoria-inexistente"] }),
      },
    );

    assert.equal(invalidServices.status, 400);

    const duplicatedServices = await request(
      baseUrl,
      "/api/provider/especialidades",
      "provider-token",
      {
        method: "PATCH",
        body: JSON.stringify({ services: ["plomeria", "plomeria"] }),
      },
    );

    assert.equal(duplicatedServices.status, 400);

    const invalidAvailability = await request(
      baseUrl,
      "/api/provider/disponibilidad",
      "provider-token",
      {
        method: "PATCH",
        body: JSON.stringify({ availability: 123 }),
      },
    );

    assert.equal(invalidAvailability.status, 400);

    const missingAvailability = await request(
      baseUrl,
      "/api/provider/disponibilidad",
      "provider-token",
      {
        method: "PATCH",
        body: JSON.stringify({}),
      },
    );

    assert.equal(missingAvailability.status, 400);

    const extraSpecialtiesField = await request(
  baseUrl,
  "/api/provider/especialidades",
  "provider-token",
  {
    method: "PATCH",
    body: JSON.stringify({
      services: ["plomeria"],
      availability: "Lunes a viernes",
    }),
  },
);

assert.equal(extraSpecialtiesField.status, 400);

const extraAvailabilityField = await request(
  baseUrl,
  "/api/provider/disponibilidad",
  "provider-token",
  {
    method: "PATCH",
    body: JSON.stringify({
      availability: "Lunes a viernes",
      services: ["plomeria"],
    }),
  },
);

assert.equal(extraAvailabilityField.status, 400);

    assert.equal(
      db.read("providerProfiles", "provider-uid"),
      undefined,
    );
  });
});