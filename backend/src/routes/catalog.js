import express from "express";

export function createCatalogRouter(catalogService) {
  const router = express.Router();
  const handle = (key, operation) => async (request, response, next) => {
    try {
      response.json({ status: "ok", [key]: await operation(request) });
    } catch (error) {
      next(error);
    }
  };
  router.get("/categorias", handle("categories", () => catalogService.listCategories()));
  router.get("/proveedores", handle("providers", (request) => catalogService.listProviders({ categoryId: request.query.categoria || undefined })));
  router.get("/proveedores/:id", handle("provider", (request) => catalogService.getProvider(request.params.id)));
  return router;
}
