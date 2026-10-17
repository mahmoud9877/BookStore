/**
 * Base class for errors that map to an HTTP status. `details` are extra fields
 * merged into the JSON response body next to `message`.
 */
export class HttpError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request", details) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", details) {
    super(401, message, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", details) {
    super(403, message, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found", details) {
    super(404, message, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict", details) {
    super(409, message, details);
  }
}

export class BadGatewayError extends HttpError {
  constructor(message = "Bad gateway", details) {
    super(502, message, details);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = "Service unavailable", details) {
    super(503, message, details);
  }
}
