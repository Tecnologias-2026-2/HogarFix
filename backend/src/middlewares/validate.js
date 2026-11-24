
export function validate(validator, source = "body") {
  if (typeof validator !== "function") {
    throw new TypeError("El validador debe ser una función.");
  }

  if (!["body", "params", "query"].includes(source)) {
    throw new TypeError("Origen de validación no permitido.");
  }

  return function validateRequest(request, _response, next) {
    try {
      const data = request[source];
      const validatedData = validator(data);

      if (validatedData && typeof validatedData.then === "function") {
        return Promise.resolve(validatedData)
          .then(() => next())
          .catch(next);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
