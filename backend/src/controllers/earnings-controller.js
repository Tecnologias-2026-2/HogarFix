export const getProviderEarnings = (earningsService) =>
  async (request, response, next) => {
    try {
      const { from, to } = request.query;

      const earnings = await earningsService.getEarnings({
        providerUid: request.auth.uid,
        from,
        to,
        period: "month"
      });

      response.status(200).json({
        status: "ok",
        ...earnings
      });
    } catch (error) {
      next(error);
    }
  };

export const getProviderEarningsBreakdown = (earningsService) =>
  async (request, response, next) => {
    try {
      const { from, to, period = "month" } = request.query;

      const earnings = await earningsService.getEarnings({
        providerUid: request.auth.uid,
        from,
        to,
        period
      });

      response.status(200).json({
        status: "ok",
        ...earnings
      });
    } catch (error) {
      next(error);
    }
  };
