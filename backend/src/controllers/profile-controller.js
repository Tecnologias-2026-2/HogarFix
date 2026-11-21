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