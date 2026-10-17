/**
 * Public base URL of this API as the client reached it. Behind the production
 * nginx proxy the API is served under /api, announced via X-Forwarded-Prefix.
 */
export const publicBaseUrl = (req) =>
  `${req.protocol}://${req.headers.host}${req.get("x-forwarded-prefix") ?? ""}`;
