import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogService } from "../src/services/catalog-service.js";

class Snapshot {
  constructor(id, data) { this.id = id; this.value = data; this.exists = data !== undefined; }
  data() { return structuredClone(this.value); }
  get(field) { return field.split(".").reduce((value, key) => value?.[key], this.value); }
}

function createDb() {
  const docs = {
    categories: {
      plomeria: { name: "Plomería", description: "Reparaciones", fixedPriceCOP: 35000, durationMinutes: 60, active: true },
      disabled: { name: "Oculta", fixedPriceCOP: 1000, durationMinutes: 30, active: false },
    },
    providerCatalog: {
      approved: { providerUid: "uid-approved", active: true },
      inactive: { providerUid: "uid-inactive", active: false },
    },
    users: { "uid-approved": { firstName: "Ana", lastName: "Ríos", email: "private@example.test" } },
  };
  return {
    collection(name) {
      return {
        doc(id) {
          return {
            async get() { return new Snapshot(id, docs[name]?.[id]); },
          };
        },
        where(field, operator, value) {
          assert.equal(operator, "==");
          return {
            limit() { return this; },
            async get() {
              return { docs: Object.entries(docs[name] || {})
                .filter(([, data]) => data[field] === value)
                .map(([id, data]) => new Snapshot(id, data)) };
            },
          };
        },
      };
    },
  };
}

test("el catálogo expone solo categorías activas en el formato del frontend", async () => {
  const service = createCatalogService({ db: createDb(), profileService: {} });
  const categories = await service.listCategories();
  assert.equal(categories.length, 1);
  assert.equal(categories[0].id, "plomeria");
  assert.equal(categories[0].tarifa, 35000);
  assert.equal(categories[0].nombre, "Plomería");
});

test("el catálogo publica solo proveedores elegibles y no expone correo", async () => {
  const db = createDb();
  const service = createCatalogService({
    db,
    profileService: {
      async getProviderEligibility(uid) { return { eligible: uid === "uid-approved" }; },
      async getProviderProfile() {
        return { services: ["plomeria"], ratingAverage: 4.5, ratingCount: 2, bio: "Proveedor con experiencia comprobada en trabajos residenciales.", coverageZone: "Bogotá", availability: "Lunes a sábado" };
      },
    },
  });
  const providers = await service.listProviders({ categoryId: "plomeria" });
  assert.equal(providers.length, 1);
  assert.equal(providers[0].providerCatalogId, "approved");
  assert.equal(providers[0].name, "Ana Ríos");
  assert.equal(providers[0].rating, 4.5);
  assert.equal("email" in providers[0], false);
});

test("un proveedor inexistente responde 404 con código PROVIDER_NOT_FOUND", async () => {
  const service = createCatalogService({ db: createDb(), profileService: {} });
  await assert.rejects(service.getProvider("no-existe"), {
    statusCode: 404,
    code: "PROVIDER_NOT_FOUND",
  });
});

test("un proveedor inactivo en el catálogo responde 404", async () => {
  const service = createCatalogService({ db: createDb(), profileService: {} });
  await assert.rejects(service.getProvider("inactive"), {
    statusCode: 404,
    code: "PROVIDER_NOT_FOUND",
  });
});

test("un identificador de catálogo malformado responde 400", async () => {
  const service = createCatalogService({ db: createDb(), profileService: {} });
  await assert.rejects(service.getProvider("a/b"), {
    statusCode: 400,
    code: "INVALID_CATALOG_ID",
  });
});

test("filtrar por una categoría inactiva responde 404 con código CATEGORY_NOT_FOUND", async () => {
  const service = createCatalogService({ db: createDb(), profileService: {} });
  await assert.rejects(service.listProviders({ categoryId: "disabled" }), {
    statusCode: 404,
    code: "CATEGORY_NOT_FOUND",
  });
});

test("un fallo de Firestore en el catálogo responde 503 sin detalles internos", async () => {
  const brokenDb = {
    collection() {
      throw Object.assign(new Error("credenciales internas"), { code: "unavailable" });
    },
  };
  const service = createCatalogService({ db: brokenDb, profileService: {} });
  await assert.rejects(service.listCategories(), (error) => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.code, "FIRESTORE_UNAVAILABLE");
    assert.doesNotMatch(error.message, /credenciales/);
    return true;
  });
});
