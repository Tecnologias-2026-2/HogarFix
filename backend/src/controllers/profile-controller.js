export const getMyProfile = (profileService) => async (request, response, next) => {
  try {
    const profile = await profileService.getMyProfile(request.auth.uid);
    response.status(200).json({ status: "ok", profile });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = (profileService) => async (request, response, next) => {
  try {
    const profile = await profileService.updateMyProfile(request.auth.uid, request.body);
    response.status(200).json({ status: "ok", profile });
  } catch (error) {
    next(error);
  }
};

export const getProviderProfile = (profileService) => async (request, response, next) => {
  try {
    const profile = await profileService.getProviderProfile(request.auth.uid);
    response.status(200).json({ status: "ok", profile });
  } catch (error) {
    next(error);
  }
};

export const updateProviderProfile = (profileService) => async (request, response, next) => {
  try {
    const profile = await profileService.updateProviderProfile(request.auth.uid, request.body);
    response.status(200).json({ status: "ok", profile });
  } catch (error) {
    next(error);
  }
};

export const getProviderEligibility = (profileService) => async (request, response, next) => {
  try {
    const eligibility = await profileService.getProviderEligibility(request.auth.uid);
    response.status(200).json({ status: "ok", eligibility });
  } catch (error) {
    next(error);
  }
};

export const getProviderSpecialties = (profileService) => async (request, response, next) => {
  try {
    const profile = await profileService.getProviderProfile(request.auth.uid);

    response.status(200).json({
      status: "ok",
      services: profile.services,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProviderSpecialties = (profileService) => async (request, response, next) => {
  try {
    const body = request.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "services")
    ) {
      return response.status(400).json({
        status: "error",
        code: "INVALID_PROFILE",
        message: "Envía las especialidades en formato JSON.",
      });
    }

    const profile = await profileService.updateProviderProfile(
      request.auth.uid,
      body,
    );

    response.status(200).json({
      status: "ok",
      services: profile.services,
    });
  } catch (error) {
    next(error);
  }
};

export const getProviderAvailability = (profileService) => async (request, response, next) => {
  try {
    const profile = await profileService.getProviderProfile(request.auth.uid);

    response.status(200).json({
      status: "ok",
      availability: profile.availability,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProviderAvailability = (profileService) => async (request, response, next) => {
  try {
    const body = request.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "availability")
    ) {
      return response.status(400).json({
        status: "error",
        code: "INVALID_PROFILE",
        message: "Solo se permite actualizar el campo availability.",
      });
    }

    const profile = await profileService.updateProviderProfile(
      request.auth.uid,
      body,
    );

    response.status(200).json({
      status: "ok",
      availability: profile.availability,
    });
  } catch (error) {
    next(error);
  }
};
