export function updateProviderApproval(profileService) {
  return async (request, response, next) => {
    try {
      const profile = await profileService.setProviderApproval(
        request.params.uid,
        request.body?.status,
        request.auth.uid,
      );
      response.status(200).json({ status: "ok", profile });
    } catch (error) {
      next(error);
    }
  };
}