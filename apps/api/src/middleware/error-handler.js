import { env } from "../config/env.js";
import { HttpError } from "../core/http-errors.js";

/** Forwards rejected promises from async route handlers to the error handler. */
export const asyncHandler = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const isHttpStatus = (value) => Number.isInteger(value) && value >= 400 && value < 600;

function resolveStatus(err) {
  if (err instanceof HttpError) return err.status;
  if (isHttpStatus(err.cause)) return err.cause;
  if (isHttpStatus(err.status)) return err.status; // body-parser, multer
  if (isHttpStatus(err.statusCode)) return err.statusCode;
  if (err.name === "CastError" || err.name === "ValidationError") return 400;
  if (err.name === "MulterError") return 400;
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") return 401;
  if (err.code === 11000) return 409;
  return 500;
}

export const notFoundHandler = (req, res) => {
  return res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Express recognizes error handlers by their four-argument signature.
// eslint-disable-next-line no-unused-vars
export const globalErrorHandler = (err, req, res, next) => {
  const status = resolveStatus(err);
  if (status >= 500) console.error(err);

  // Never leak internal error details or stack traces in production.
  const hideDetails = env.isProduction && status >= 500;
  const body = { message: hideDetails ? "Internal server error" : err.message };
  if (!env.isProduction && err.stack) body.stack = err.stack;
  return res.status(status).json(body);
};
