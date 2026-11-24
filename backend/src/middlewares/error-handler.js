const SAFE_CLIENT_ERROR_CODES = new Set([
  "INVALID_UID",
  "INVALID_DATE",
  "INVALID_DATE_RANGE",
  "INVALID_PERIOD",
  "INVALID_PROFILE",
  "INVALID_REQUEST",
  "INVALID_REQUEST_ID",
  "INVALID_REQUEST_SCHEDULE",
  "PROTECTED_REQUEST_FIELDS",
  "INVALID_REQUEST_TRANSITION",
  "INVALID_IDEMPOTENCY_KEY",
  "IDEMPOTENCY_INVALID",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_LIMIT",
  "INVALID_RATING",
  "INVALID_RATING_COMMENT",
  "INVALID_APPROVAL_STATUS",
  "PROFILE_NOT_FOUND",
  "PROFILE_ALREADY_EXISTS",
  "INVALID_CATALOG_ID",
  "FORBIDDEN",
  "ACCOUNT_DISABLED",
  "PROFILE_INCOMPLETE",
  "CATEGORY_NOT_FOUND",
  "PROVIDER_NOT_FOUND",
  "PROVIDER_NOT_ELIGIBLE",
  "PROVIDER_SCHEDULE_CONFLICT",
  "PROTECTED_RATING_FIELDS",
  "CATEGORY_INVALID",
  "PROVIDER_LINK_CHANGED",
  "CATEGORY_CHANGED",
  "REQUEST_NOT_FOUND",
  "REQUEST_NOT_COMPLETED",
  "RATING_ALREADY_EXISTS",
  "INVALID_SUPPORT_INPUT",
  "SUPPORT_NOT_FOUND"
]);

const SAFE_STATUS_CODES = new Set([
  400, 401, 403, 404, 409, 422
]);

export function notFoundHandler(_request, response) {
  return response.status(404).json({
    status: "error",
    message: "Ruta no encontrada"
  });
}

export function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  if (error?.type === "entity.parse.failed") {
    return response.status(400).json({
      status: "error",
      message: "El cuerpo de la solicitud no contiene JSON válido."
    });
  }


  if (error?.statusCode === 503) {
      return response.status(503).json({
      status: "error",
      message: "Servicio temporalmente no disponible."
    });
  }


  const status = Number(error?.statusCode || error?.status);

  const isSafeClientError =
    SAFE_STATUS_CODES.has(status) &&
    SAFE_CLIENT_ERROR_CODES.has(error?.code);

  if (isSafeClientError) {
    return response.status(status).json({
      status: "error",
      code: error.code,
      message: error.message
    });
  }

  if (
    status === 403 &&
    error?.message === "Origin not allowed."
  ) {
    return response.status(403).json({
      status: "error",
      message: "Origen no permitido."
    });
  }

  console.error("Unhandled API error:", {
    code: typeof error?.code === "string"
      ? error.code
      : "unknown",
    status: Number.isInteger(status) ? status : 500
  });

  return response.status(500).json({
    status: "error",
    message: "Error interno del servidor."
  });
}
