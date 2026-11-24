function handle(serviceOperation, responseName, statusCode = 200) {
  return async (request, response, next) => {
    try {
      const result = await serviceOperation(request);
      response.status(statusCode).json({ status: "ok", [responseName]: result });
    } catch (error) {
      next(error);
    }
  };
}

export function createRequestControllers(requestService) {
  return Object.freeze({
    createClientRequest: handle(
      (request) =>
        requestService.createRequest({
          clientUid: request.auth.uid,
          input: request.body,
          idempotencyKey: request.get("idempotency-key"),
        }),
      "request",
      201,
    ),
    listClientRequests: handle(
      (request) =>
        requestService.listRequests({
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
        }),
      "requests",
    ),
    getClientRequest: handle(
      (request) =>
        requestService.getRequest({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
        }),
      "request",
    ),
    confirmClientRequest: handle(
      (request) =>
        requestService.transitionRequest({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
          action: "confirm",
        }),
      "request",
    ),
    cancelClientRequest: handle(
      (request) =>
        requestService.transitionRequest({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
          action: "cancel",
        }),
      "request",
    ),
    listProviderRequests: handle(
      (request) =>
        requestService.listRequests({
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
        }),
      "requests",
    ),
    getProviderRequest: handle(
      (request) =>
        requestService.getRequest({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
        }),
      "request",
    ),
    acceptProviderRequest: handle(
      (request) =>
        requestService.transitionRequest({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
          action: "accept",
        }),
      "request",
    ),
    rejectProviderRequest: handle(
      (request) =>
        requestService.transitionRequest({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
          action: "reject",
        }),
      "request",
    ),
    startProviderRequest: handle(
      (request) =>
        requestService.transitionRequest({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
          action: "start",
        }),
      "request",
    ),
    completeProviderRequest: handle(
      (request) =>
        requestService.transitionRequest({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
          action: "complete",
        }),
      "request",
    ),
    createClientRating: handle(
      (request) =>
        requestService.createRating({
          requestId: request.params.id,
          clientUid: request.auth.uid,
          input: request.body,
        }),
      "rating",
      201,
    ),
    getClientRequestRating: handle(
      (request) =>
        requestService.getRequestRating({
          requestId: request.params.id,
          clientUid: request.auth.uid,
        }),
      "rating",
    ),
    listProviderRatings: handle(
      (request) => requestService.listProviderRatings({ providerUid: request.params.uid }),
      "summary",
    ),
    listRequestMessages: handle(
      (request) =>
        requestService.listMessages({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
        }),
      "chat",
    ),
    sendRequestMessage: handle(
      (request) =>
        requestService.sendMessage({
          requestId: request.params.id,
          actorUid: request.auth.uid,
          actorRole: request.auth.role,
          input: request.body,
        }),
      "message",
      201,
    ),
  });
}
