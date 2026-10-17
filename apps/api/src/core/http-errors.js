/** Base class for errors that map to an HTTP status. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request") {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict") {
    super(409, message);
  }
}

export class BadGatewayError extends HttpError {
  constructor(message = "Bad gateway") {
    super(502, message);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = "Service unavailable") {
    super(503, message);
  }
}
