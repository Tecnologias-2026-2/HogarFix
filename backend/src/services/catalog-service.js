import { getAdminFirestore } from "../config/firebase-admin.js";
import { createProfileService } from "./profile-service.js";

const MAX_CATALOG_ITEMS = 100;
const CATEGORIES = Object.freeze({
  plomeria: { color: "blue", icono: "assets/service-plumbing.svg", emoji: "🔧" },
  electricidad: { color: "yellow", icono: "assets/service-electric.svg", emoji: "⚡" },
  jardineria: { color: "green", icono: "assets/service-garden.svg", emoji: "🌿" },
  "aseo-general": { color: "blue", icono: "assets/service-cleaning.svg", emoji: "🧹" },
});

function invalid(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function validId(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 128 || value.includes("/")) {
    throw invalid("El identificador del catálogo no es válido.");
  }
  return value.trim();
}

export function createCatalogService({ db, profileService, requestService } = {}) {
  const firestore = () => db || getAdminFirestore();
  const profiles = profileService || createProfileService({ db });

  async function listCategories() {
    const snapshot = await firestore().collection("categories").where("active", "==", true).limit(MAX_CATALOG_ITEMS).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const metadata = CATEGORIES[doc.id] || {};
      return {
        id: doc.id,
        name: data.name,
        nombre: data.name,
        description: data.description || "Servicios para el hogar.",
        descripcion: data.description || "Servicios para el hogar.",
        fixedPriceCOP: data.fixedPriceCOP,
        tarifa: data.fixedPriceCOP,
        durationMinutes: data.durationMinutes,
        ...metadata,
      };
    });
  }

  async function presentProvider(catalogId, catalogData) {
    if (catalogData?.active !== true || typeof catalogData.providerUid !== "string") return null;
    const uid = catalogData.providerUid;
    const [eligibility, profile, user] = await Promise.all([
      profiles.getProviderEligibility(uid),
      profiles.getProviderProfile(uid),
      firestore().collection("users").doc(uid).get(),
    ]);
    if (!eligibility.eligible || !user.exists) return null;
    const categoryIds = profile.services.filter((id) => CATEGORIES[id]);
    if (!categoryIds.length) return null;
    const categories = await Promise.all(categoryIds.map(async (id) => {
      const snapshot = await firestore().collection("categories").doc(id).get();
      return snapshot.exists && snapshot.get("active") === true ? snapshot.data() : null;
    }));
    const services = categories.filter(Boolean).map((category) => category.name);
    const rating = Number.isFinite(profile.ratingAverage) ? Number(profile.ratingAverage.toFixed(1)) : null;
    const ratingSummary = requestService
      ? await requestService.listProviderRatings({ providerUid: uid })
      : { ratings: [] };
    return {
      id: catalogId,
      providerCatalogId: catalogId,
      providerUid: uid,
      name: [user.get("firstName"), user.get("lastName")].filter(Boolean).join(" "),
      profession: services.join(" · "),
      categorias: categoryIds,
      categoryIds,
      categoryIdsByCatalog: categoryIds,
      services,
      rating,
      jobs: profile.ratingCount || 0,
      reviews: profile.ratingCount || 0,
      available: true,
      distanceKm: null,
      zone: profile.coverageZone,
      availability: profile.availability,
      bio: profile.bio,
      photo: profile.photo || "assets/provider-avatar.svg",
      resenas: ratingSummary.ratings.map((item) => ({
        estrellas: item.rating,
        autor: item.clientDisplayName || "Cliente",
        comentario: item.comment || "",
      })),
    };
  }

  async function getProvider(id) {
    const catalogId = validId(id);
    const snapshot = await firestore().collection("providerCatalog").doc(catalogId).get();
    if (!snapshot.exists) throw invalid("No encontramos a este profesional.", 404);
    const provider = await presentProvider(catalogId, snapshot.data());
    if (!provider) throw invalid("Este profesional no está disponible en el catálogo.", 404);
    return provider;
  }

  async function listProviders({ categoryId } = {}) {
    if (categoryId) {
      validId(categoryId);
      const category = await firestore().collection("categories").doc(categoryId).get();
      if (!category.exists || category.get("active") !== true) throw invalid("La categoría no está disponible.", 404);
    }
    const snapshot = await firestore().collection("providerCatalog").where("active", "==", true).limit(MAX_CATALOG_ITEMS).get();
    const providers = await Promise.all(snapshot.docs.map((doc) => presentProvider(doc.id, doc.data())));
    return providers.filter((provider) => provider && (!categoryId || provider.categoryIds.includes(categoryId)));
  }

  return Object.freeze({ listCategories, listProviders, getProvider });
}
