import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";

const identities = {
  "client-token": { uid: "client-uid", email: "client@example.test" },
  "provider-token": { uid: "provider-uid", email: "provider@example.test" },
  "orphan-token": { uid: "orphan-uid", email: "orphan@example.test" },
};

const profiles = {
  "client-uid": { email: "client@example.test", role: "Cliente" },
  "provider-uid": { email: "provider@example.test", role: "Proveedor" },
};

function fakeError(code) {
  return Object.assign(new Error("test error"), { code });
}

function createTestApp({ profileOverrides = {}, failProfileLookup = false } = {}) {
  const calls = [];
  const app = createApp({
    verifyIdToken: async (token, checkRevoked) => {
      calls.push(["verify", token, checkRevoked]);
      if (token === "expired-token") throw fakeError("auth/id-token-expired");
      if (token === "revoked-token") throw fakeError("auth/id-token-revoked");
      const identity = identities[token];
      if (!identity) throw fakeError("auth/invalid-id-token");
      return identity;
    },
    loadUserProfile: async (uid) => {
      calls.push(["profile", uid]);
      if (failProfileLookup) throw fakeError("unavailable");
      return profileOverrides[uid] || profiles[uid] || null;
    },
  });
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

test("health remains public", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
  });
  assert.deepEqual(calls, []);
});

test("private route rejects a missing token", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/client/me`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "UNAUTHENTICATED");
  });
  assert.deepEqual(calls, []);
});

test("client identity comes from the verified token and Firestore profile", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/client/me?uid=provider-uid`, {
      headers: {
        Authorization: "Bearer client-token",
        "X-User-Role": "Proveedor",
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).user, {
      uid: "client-uid",
      email: "client@example.test",
      role: "Cliente",
    });
  });
  assert.deepEqual(calls, [
    ["verify", "client-token", true],
    ["profile", "client-uid"],
  ]);
});

test("provider can access only the provider route", async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/provider/me`, {
      headers: { Authorization: "Bearer provider-token" },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.role, "Proveedor");
  });
});

test("client and provider routes deny the opposite role", async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const providerOnClientRoute = await fetch(`${baseUrl}/api/client/me`, {
      headers: { Authorization: "Bearer provider-token" },
    });
    const clientOnProviderRoute = await fetch(`${baseUrl}/api/provider/me`, {
      headers: { Authorization: "Bearer client-token" },
    });
    assert.equal(providerOnClientRoute.status, 403);
    assert.equal(clientOnProviderRoute.status, 403);
  });
});

test("invalid, expired, and revoked tokens are rejected without profile lookup", async () => {
  const { app, calls } = createTestApp();
  await withServer(app, async (baseUrl) => {
    for (const token of ["invalid-token", "expired-token", "revoked-token"]) {
      const response = await fetch(`${baseUrl}/api/client/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 401);
    }
  });
  assert.equal(calls.filter(([kind]) => kind === "profile").length, 0);
});

test("missing, invalid, or mismatched profiles are denied", async () => {
  const { app } = createTestApp({
    profileOverrides: {
      "client-uid": { email: "client@example.test", role: "Administrador" },
      "provider-uid": { email: "other@example.test", role: "Proveedor" },
    },
  });
  await withServer(app, async (baseUrl) => {
    const invalidRole = await fetch(`${baseUrl}/api/client/me`, {
      headers: { Authorization: "Bearer client-token" },
    });
    const mismatchedEmail = await fetch(`${baseUrl}/api/provider/me`, {
      headers: { Authorization: "Bearer provider-token" },
    });
    const missingProfile = await fetch(`${baseUrl}/api/client/me`, {
      headers: { Authorization: "Bearer orphan-token" },
    });
    assert.equal(invalidRole.status, 403);
    assert.equal(mismatchedEmail.status, 403);
    assert.equal(missingProfile.status, 403);
  });
});

test("Firebase profile lookup failures return a safe service error", async () => {
  const { app } = createTestApp({ failProfileLookup: true });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/client/me`, {
      headers: { Authorization: "Bearer client-token" },
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "AUTH_UNAVAILABLE");
  });
});
