import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createRequestFixture } from "./fixtures.js";

async function fixtureFor(testContext, options) {
  const fixture = await createRequestFixture(options);
  testContext.after(() => fixture.cleanup());
  return fixture;
}

async function requestsForClient(fixture) {
  return fixture.db
    .collection("solicitudes")
    .where("clientUid", "==", fixture.clientUid)
    .get();
}

test("creates a request and its idempotency record and audit event in Firestore", async (t) => {
  const fixture = await fixtureFor(t);
  const key = `integration-${randomUUID()}`;
  const created = await fixture.createRequest({ idempotencyKey: key });

  const stored = await fixture.db.collection("solicitudes").doc(created.id).get();
  assert.equal(stored.exists, true);
  assert.equal(stored.get("status"), "Pendiente");
  assert.equal(stored.get("clientUid"), fixture.clientUid);
  assert.equal(stored.get("providerUid"), fixture.providerUid);
  assert.equal(stored.get("categorySnapshot.priceCOP"), 35000);

  const idempotency = await fixture.idempotencyRef(key).get();
  assert.equal(idempotency.exists, true);
  assert.equal(idempotency.get("requestId"), created.id);

  const events = await fixture.eventsFor(created.id);
  assert.equal(events.length, 1);
  assert.deepEqual(
    [events[0].type, events[0].actorUid, events[0].actorRole, events[0].toStatus],
    ["created", fixture.clientUid, "Cliente", "Pendiente"],
  );
});

test("lists and returns only owned requests and returns 404 for absent or foreign requests", async (t) => {
  const fixture = await fixtureFor(t);
  const own = await fixture.createRequest();
  const foreignId = await fixture.seedForeignRequest({
    clientUid: fixture.newId("other-client"),
    providerUid: fixture.newId("other-provider"),
    status: "Pendiente",
  });

  const clientList = await fixture.service.listRequests({
    actorUid: fixture.clientUid,
    actorRole: "Cliente",
  });
  const providerList = await fixture.service.listRequests({
    actorUid: fixture.providerUid,
    actorRole: "Proveedor",
  });
  assert.deepEqual(clientList.map(({ id }) => id), [own.id]);
  assert.deepEqual(providerList.map(({ id }) => id), [own.id]);
  assert.equal(
    (await fixture.service.getRequest({
      requestId: own.id,
      actorUid: fixture.clientUid,
      actorRole: "Cliente",
    })).id,
    own.id,
  );

  for (const [requestId, actorUid, actorRole] of [
    [foreignId, fixture.clientUid, "Cliente"],
    [foreignId, fixture.providerUid, "Proveedor"],
    [fixture.newId("missing-request"), fixture.clientUid, "Cliente"],
    [fixture.newId("missing-request"), fixture.providerUid, "Proveedor"],
  ]) {
    await assert.rejects(
      fixture.service.getRequest({ requestId, actorUid, actorRole }),
      (error) => error.statusCode === 404 && error.code === "REQUEST_NOT_FOUND",
    );
  }
});

test("rejects missing, inactive, or unregistered provider associations and ineligible accounts", async (t) => {
  const fixture = await fixtureFor(t);

  await assert.rejects(
    fixture.createRequest({ input: { providerCatalogId: fixture.newId("missing-catalog") } }),
    (error) => error.statusCode === 404 && error.code === "PROVIDER_NOT_FOUND",
  );

  await fixture.setCatalogActive(false);
  await assert.rejects(
    fixture.createRequest(),
    (error) => error.statusCode === 404 && error.code === "PROVIDER_NOT_FOUND",
  );

  const unregisteredProviderUid = fixture.newId("unregistered-provider");
  const danglingCatalogId = fixture.newId("dangling-catalog");
  await fixture.seedCatalog(danglingCatalogId, unregisteredProviderUid);
  await assert.rejects(
    fixture.createRequest({ input: { providerCatalogId: danglingCatalogId } }),
    (error) => error.statusCode === 404 && error.code === "PROFILE_NOT_FOUND",
  );

  await fixture.setCatalogActive(true);
  fixture.setProviderDisabled(true);
  await assert.rejects(
    fixture.createRequest(),
    (error) => error.statusCode === 409 && error.code === "PROVIDER_NOT_ELIGIBLE",
  );
});

test("rejects missing and inactive categories", async (t) => {
  const fixture = await fixtureFor(t);

  await assert.rejects(
    fixture.createRequest({ input: { categoryId: fixture.newId("missing-category") } }),
    (error) => error.statusCode === 404 && error.code === "CATEGORY_NOT_FOUND",
  );

  await fixture.setCategoryActive(false);
  await assert.rejects(
    fixture.createRequest(),
    (error) => error.statusCode === 404 && error.code === "CATEGORY_NOT_FOUND",
  );

  assert.equal((await requestsForClient(fixture)).size, 0);
});

test("persists allowed transitions and each corresponding audit event", async (t) => {
  const fixture = await fixtureFor(t);
  const request = await fixture.createRequest();

  assert.equal((await fixture.service.transitionRequest({
    requestId: request.id,
    actorUid: fixture.providerUid,
    actorRole: "Proveedor",
    action: "accept",
  })).status, "Aceptada");
  assert.equal((await fixture.service.transitionRequest({
    requestId: request.id,
    actorUid: fixture.clientUid,
    actorRole: "Cliente",
    action: "confirm",
  })).status, "Confirmada");
  assert.equal((await fixture.service.transitionRequest({
    requestId: request.id,
    actorUid: fixture.providerUid,
    actorRole: "Proveedor",
    action: "start",
  })).status, "En proceso");
  assert.equal((await fixture.service.transitionRequest({
    requestId: request.id,
    actorUid: fixture.providerUid,
    actorRole: "Proveedor",
    action: "complete",
  })).status, "Completada");

  const finalDocument = await fixture.db.collection("solicitudes").doc(request.id).get();
  assert.equal(finalDocument.get("status"), "Completada");
  const events = await fixture.eventsFor(request.id);
  assert.deepEqual(events.map(({ fromStatus, toStatus }) => [fromStatus, toStatus]), [
    [null, "Pendiente"],
    ["Pendiente", "Aceptada"],
    ["Aceptada", "Confirmada"],
    ["Confirmada", "En proceso"],
    ["En proceso", "Completada"],
  ]);
  assert.equal(events.length, 5);

  const rejected = await fixture.createRequest();
  assert.equal((await fixture.service.transitionRequest({
    requestId: rejected.id,
    actorUid: fixture.providerUid,
    actorRole: "Proveedor",
    action: "reject",
  })).status, "Rechazada");

  const cancelled = await fixture.createRequest();
  assert.equal((await fixture.service.transitionRequest({
    requestId: cancelled.id,
    actorUid: fixture.clientUid,
    actorRole: "Cliente",
    action: "cancel",
  })).status, "Cancelada");
});

test("invalid transitions leave Firestore state and audit events unchanged", async (t) => {
  const fixture = await fixtureFor(t);
  const request = await fixture.createRequest();

  for (const [actorUid, actorRole, action] of [
    [fixture.clientUid, "Cliente", "confirm"],
    [fixture.providerUid, "Proveedor", "start"],
    [fixture.providerUid, "Proveedor", "complete"],
  ]) {
    await assert.rejects(
      fixture.service.transitionRequest({
        requestId: request.id,
        actorUid,
        actorRole,
        action,
      }),
      (error) => error.statusCode === 409 && error.code === "INVALID_REQUEST_TRANSITION",
    );
    const stored = await fixture.db.collection("solicitudes").doc(request.id).get();
    assert.equal(stored.get("status"), "Pendiente");
    assert.equal((await fixture.eventsFor(request.id)).length, 1);
  }

  await assert.rejects(
    fixture.service.transitionRequest({
      requestId: request.id,
      actorUid: fixture.clientUid,
      actorRole: "Cliente",
      action: "accept",
    }),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN",
  );
  assert.equal((await fixture.db.collection("solicitudes").doc(request.id).get()).get("status"), "Pendiente");
  assert.equal((await fixture.eventsFor(request.id)).length, 1);
});

test("clients and providers cannot transition requests owned by someone else", async (t) => {
  const fixture = await fixtureFor(t);
  const foreignClientRequest = await fixture.seedForeignRequest({
    clientUid: fixture.newId("other-client"),
    providerUid: fixture.providerUid,
    status: "Pendiente",
  });
  const foreignProviderRequest = await fixture.seedForeignRequest({
    clientUid: fixture.clientUid,
    providerUid: fixture.newId("other-provider"),
    status: "Pendiente",
  });

  await assert.rejects(
    fixture.service.transitionRequest({
      requestId: foreignClientRequest,
      actorUid: fixture.clientUid,
      actorRole: "Cliente",
      action: "cancel",
    }),
    (error) => error.statusCode === 404 && error.code === "REQUEST_NOT_FOUND",
  );
  await assert.rejects(
    fixture.service.transitionRequest({
      requestId: foreignProviderRequest,
      actorUid: fixture.providerUid,
      actorRole: "Proveedor",
      action: "reject",
    }),
    (error) => error.statusCode === 404 && error.code === "REQUEST_NOT_FOUND",
  );

  for (const requestId of [foreignClientRequest, foreignProviderRequest]) {
    assert.equal((await fixture.db.collection("solicitudes").doc(requestId).get()).get("status"), "Pendiente");
    assert.deepEqual(await fixture.eventsFor(requestId), []);
  }
});

test("replays an idempotency key and rejects reuse with a different payload", async (t) => {
  const fixture = await fixtureFor(t);
  const key = `integration-${randomUUID()}`;
  const first = await fixture.createRequest({ idempotencyKey: key });
  const replay = await fixture.createRequest({ idempotencyKey: key });

  assert.equal(replay.id, first.id);
  assert.equal((await requestsForClient(fixture)).size, 1);
  assert.equal((await fixture.eventsFor(first.id)).length, 1);
  assert.equal((await fixture.idempotencyRef(key).get()).get("requestId"), first.id);

  await assert.rejects(
    fixture.createRequest({
      idempotencyKey: key,
      input: { detail: "Un detalle diferente para reutilizar la clave." },
    }),
    (error) => error.statusCode === 409 && error.code === "IDEMPOTENCY_CONFLICT",
  );
  assert.equal((await requestsForClient(fixture)).size, 1);
});

test("concurrent identical creations converge on one request and one audit event", async (t) => {
  const fixture = await fixtureFor(t);
  const key = `integration-${randomUUID()}`;

  const results = await Promise.all(
    Array.from({ length: 5 }, () => fixture.createRequest({ idempotencyKey: key })),
  );

  assert.equal(new Set(results.map(({ id }) => id)).size, 1);
  assert.equal((await requestsForClient(fixture)).size, 1);
  assert.equal((await fixture.eventsFor(results[0].id)).length, 1);
  assert.equal((await fixture.idempotencyRef(key).get()).get("requestId"), results[0].id);
});
