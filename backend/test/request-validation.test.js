import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUEST_TIME_ZONE,
  validateCreateRequest,
  validateIdempotencyKey,
} from "../src/services/request-validation.js";

const validInput = {
  providerCatalogId: "catalog-provider-001",
  categoryId: "plomeria",
  date: "2026-11-25",
  time: "10:00",
  address: "Calle 45 #28-10",
  detail: "Reparación de una fuga en el lavaplatos.",
};
const now = () => new Date("2026-11-20T15:00:00.000Z");

test("validates all required request fields and normalizes the Bogotá schedule", () => {
  const result = validateCreateRequest(validInput, { now: now() });

  assert.equal(result.timeZone, REQUEST_TIME_ZONE);
  assert.equal(result.scheduledAt.toISOString(), "2026-11-25T15:00:00.000Z");
  assert.equal(result.providerCatalogId, validInput.providerCatalogId);
  assert.equal(result.address, validInput.address);
});

test("rejects each missing required field", () => {
  for (const field of Object.keys(validInput)) {
    const incomplete = { ...validInput };
    delete incomplete[field];
    assert.throws(
      () => validateCreateRequest(incomplete, { now: now() }),
      (error) => error.code === "INVALID_REQUEST" && error.message.includes(field),
    );
  }
});

test("rejects protected or unknown fields supplied by the client", () => {
  for (const field of ["clientUid", "providerUid", "amount", "status", "createdAt"]) {
    assert.throws(
      () => validateCreateRequest({ ...validInput, [field]: "forged" }, { now: now() }),
      (error) => error.code === "PROTECTED_REQUEST_FIELDS",
    );
  }
});

test("rejects malformed or past dates and invalid times", () => {
  for (const date of ["2026-02-30", "2026-11-19", "20-11-2026"]) {
    assert.throws(() => validateCreateRequest({ ...validInput, date }, { now: now() }));
  }
  assert.throws(
    () => validateCreateRequest({ ...validInput, time: "10:00 a. m." }, { now: now() }),
  );
});

test("rejects invalid text lengths and document identifiers", () => {
  assert.throws(
    () => validateCreateRequest({ ...validInput, address: "Casa" }, { now: now() }),
  );
  assert.throws(
    () => validateCreateRequest({ ...validInput, providerCatalogId: "bad/id" }, { now: now() }),
  );
});

test("validates idempotency keys", () => {
  assert.equal(validateIdempotencyKey("request-key-000001"), "request-key-000001");
  assert.throws(
    () => validateIdempotencyKey("short"),
    (error) => error.code === "INVALID_IDEMPOTENCY_KEY",
  );
});
