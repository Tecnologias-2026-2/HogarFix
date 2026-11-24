import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createRequestService } from "../src/services/request-service.js";

// Firestore simulado: solicitudes/{id} y su subcolección messages.
function createChatDb(requests) {
  const messages = new Map();
  let counter = 0;
  const messagesOf = (id) => {
    if (!messages.has(id)) messages.set(id, []);
    return messages.get(id);
  };
  const db = {
    collection(name) {
      assert.equal(name, "solicitudes");
      return {
        doc(id) {
          return {
            async get() {
              const data = requests[id];
              return { id, exists: Boolean(data), data: () => data };
            },
            collection(sub) {
              assert.equal(sub, "messages");
              const list = messagesOf(id);
              return {
                doc() {
                  const messageId = `m${++counter}`;
                  return { id: messageId, async set(value) { list.push({ id: messageId, ...value }); } };
                },
                orderBy(field, direction) {
                  assert.equal(field, "createdAt");
                  assert.equal(direction, "asc");
                  return {
                    limit() {
                      return {
                        async get() {
                          const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                          return { docs: sorted.map(({ id: docId, ...rest }) => ({ id: docId, data: () => rest })) };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { db, messages };
}

const REQUESTS = {
  "req-1": { clientUid: "client-1", providerUid: "provider-1", status: "Aceptada" },
  "req-closed": { clientUid: "client-1", providerUid: "provider-1", status: "Cancelada" },
};

function service() {
  let tick = 0;
  const { db, messages } = createChatDb(REQUESTS);
  const requestService = createRequestService({
    db,
    auth: {},
    profileService: {},
    now: () => new Date(Date.UTC(2026, 10, 24, 17, 0, tick++)),
  });
  return { requestService, messages };
}

test("cliente y proveedor de la solicitud se envían y leen mensajes", async () => {
  const { requestService } = service();
  await requestService.sendMessage({ requestId: "req-1", actorUid: "client-1", actorRole: "Cliente", input: { text: "  Hola, ¿a qué hora llega?  " } });
  await requestService.sendMessage({ requestId: "req-1", actorUid: "provider-1", actorRole: "Proveedor", input: { text: "A las 10:00." } });

  const forClient = await requestService.listMessages({ requestId: "req-1", actorUid: "client-1", actorRole: "Cliente" });
  assert.equal(forClient.open, true);
  assert.deepEqual(forClient.messages.map((m) => [m.text, m.senderRole, m.mine]), [
    ["Hola, ¿a qué hora llega?", "Cliente", true],
    ["A las 10:00.", "Proveedor", false],
  ]);
  const forProvider = await requestService.listMessages({ requestId: "req-1", actorUid: "provider-1", actorRole: "Proveedor" });
  assert.deepEqual(forProvider.messages.map((m) => m.mine), [false, true]);
  assert.equal("senderUid" in forProvider.messages[0], false);
});

test("quien no participa en la solicitud recibe 404 y no ve mensajes", async () => {
  const { requestService } = service();
  await assert.rejects(
    requestService.listMessages({ requestId: "req-1", actorUid: "otro-cliente", actorRole: "Cliente" }),
    { statusCode: 404, code: "REQUEST_NOT_FOUND" },
  );
  await assert.rejects(
    requestService.sendMessage({ requestId: "req-1", actorUid: "otro-proveedor", actorRole: "Proveedor", input: { text: "Hola" } }),
    { statusCode: 404, code: "REQUEST_NOT_FOUND" },
  );
});

test("mensajes vacíos, demasiado largos o con campos extra se rechazan", async () => {
  const { requestService, messages } = service();
  for (const input of [{ text: "   " }, { text: "x".repeat(1001) }, { text: "Hola", senderUid: "falso" }, null]) {
    await assert.rejects(
      requestService.sendMessage({ requestId: "req-1", actorUid: "client-1", actorRole: "Cliente", input }),
      { statusCode: 400, code: "INVALID_MESSAGE" },
    );
  }
  assert.equal((messages.get("req-1") || []).length, 0);
});

test("una solicitud cancelada o rechazada no acepta mensajes nuevos", async () => {
  const { requestService } = service();
  await assert.rejects(
    requestService.sendMessage({ requestId: "req-closed", actorUid: "client-1", actorRole: "Cliente", input: { text: "Hola" } }),
    { statusCode: 409, code: "CHAT_CLOSED" },
  );
  const chat = await requestService.listMessages({ requestId: "req-closed", actorUid: "client-1", actorRole: "Cliente" });
  assert.equal(chat.open, false);
});

test("las rutas del chat exigen token y pasan el usuario del token al servicio", async () => {
  const calls = [];
  const app = createApp(
    {
      verifyIdToken: async (token) => {
        if (token !== "client-token") throw Object.assign(new Error("invalid"), { code: "auth/invalid-id-token" });
        return { uid: "client-1", email: "client@example.test" };
      },
      loadUserProfile: async () => ({ email: "client@example.test", role: "Cliente" }),
    },
    {
      requestService: {
        async listMessages(args) { calls.push(["list", args]); return { open: true, messages: [] }; },
        async sendMessage(args) { calls.push(["send", args]); return { id: "m1", text: args.input.text, mine: true }; },
      },
    },
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/solicitudes/req-1/mensajes`;
  try {
    assert.equal((await fetch(base)).status, 401);
    const list = await fetch(base, { headers: { Authorization: "Bearer client-token" } });
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), { status: "ok", chat: { open: true, messages: [] } });
    const sent = await fetch(base, {
      method: "POST",
      headers: { Authorization: "Bearer client-token", "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hola" }),
    });
    assert.equal(sent.status, 201);
    assert.deepEqual(calls.map(([name, args]) => [name, args.requestId, args.actorUid, args.actorRole]), [
      ["list", "req-1", "client-1", "Cliente"],
      ["send", "req-1", "client-1", "Cliente"],
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
