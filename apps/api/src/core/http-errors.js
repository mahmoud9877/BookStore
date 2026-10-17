/**
 * Base class for errors that map to an HTTP status. Subclasses only declare
 * their `status` and `defaultMessage`. `details` are extra fields merged into
 * the JSON response body next to `message`.
 */
export class HttpError extends Error {
  static status = 500;
  static defaultMessage = "Internal server error";

  constructor(message = new.target.defaultMessage, details = {}) {
    super(message);
    this.name = new.target.name;
    this.status = new.target.status;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  static status = 400;
  static defaultMessage = "Bad request";
}

export class UnauthorizedError extends HttpError {
  static status = 401;
  static defaultMessage = "Unauthorized";
}

export class ForbiddenError extends HttpError {
  static status = 403;
  static defaultMessage = "Forbidden";
}

export class NotFoundError extends HttpError {
  static status = 404;
  static defaultMessage = "Not found";
}

export class ConflictError extends HttpError {
  static status = 409;
  static defaultMessage = "Conflict";
}

export class BadGatewayError extends HttpError {
  static status = 502;
  static defaultMessage = "Bad gateway";
}

export class ServiceUnavailableError extends HttpError {
  static status = 503;
  static defaultMessage = "Service unavailable";
}

/** Returns `value`, or throws NotFoundError(message) when it is null/undefined. */
export function ensureFound(value, message) {
  if (value == null) throw new NotFoundError(message);
  return value;
}
