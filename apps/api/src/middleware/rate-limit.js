import { HttpError } from "../core/http-errors.js";

class TooManyRequestsError extends HttpError {
  static status = 429;
  static defaultMessage = "Too many requests. Please slow down.";
}

/**
 * Fixed-window rate limit per client IP, in memory. It protects a single
 * instance; behind several instances put the limit at the reverse proxy too.
 */
export function rateLimit({ windowMs = 60_000, max = 30, now = () => Date.now() } = {}) {
  const hits = new Map();
  let sweepAt = now() + windowMs;

  return (req, res, next) => {
    const time = now();
    if (time > sweepAt) {
      for (const [key, entry] of hits) if (entry.resetAt <= time) hits.delete(key);
      sweepAt = time + windowMs;
    }
    const key = req.ip ?? "unknown";
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= time) {
      hits.set(key, { count: 1, resetAt: time + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - time) / 1000)));
      return next(new TooManyRequestsError());
    }
    return next();
  };
}
