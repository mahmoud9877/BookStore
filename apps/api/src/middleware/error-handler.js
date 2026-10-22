import { HttpError } from "../core/http-errors.js";

/** Forwards rejected promises from async route handlers to the error handler. */
export const asyncHandler = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const isHttpStatus = (value) => Number.isInteger(value) && value >= 400 && value < 600;

/**
 * Error -> HTTP status rules, checked in order. Supporting a new kind of error
 * means adding a rule here, not changing the handler.
 */
const STATUS_RULES = [
  [(err) => err instanceof HttpError, (err) => err.status],
  [(err) => isHttpStatus(err.cause), (err) => err.cause],
  [(err) => err.code === "LIMIT_FILE_SIZE", () => 413], // multer
  [(err) => isHttpStatus(err.status), (err) => err.status], // body-parser, multer
  [(err) => isHttpStatus(err.statusCode), (err) => err.statusCode],
  [(err) => ["CastError", "ValidationError", "MulterError"].includes(err.name), () => 400],
  [(err) => ["JsonWebTokenError", "TokenExpiredError"].includes(err.name), () => 401],
  [(err) => err.code === 11000, () => 409], // MongoDB duplicate key
];

export function resolveStatus(err) {
  const rule = STATUS_RULES.find(([matches]) => matches(err));
  return rule ? rule[1](err) : 500;
}

export const notFoundHandler = (req, res) => {
  return res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

/**
 * Builds the final error middleware. In production, internal error details and
 * stack traces never leave the server.
 */
export function createErrorHandler({ isProduction }) {
  // Express recognizes error handlers by their four-argument signature.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const status = resolveStatus(err);
    if (status >= 500) console.error(err);

    const hideDetails = isProduction && status >= 500;
    const body = { message: hideDetails ? "Internal server error" : err.message };
    if (!hideDetails && err instanceof HttpError) Object.assign(body, err.details);
    if (!isProduction && err.stack) body.stack = err.stack;
    return res.status(status).json(body);
  };
}
