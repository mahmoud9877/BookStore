import { asyncHandler } from "./error-handler.js";
import { ForbiddenError, UnauthorizedError } from "../core/http-errors.js";

/**
 * Builds authentication middleware. Requests must send
 * `Authorization: <bearerKey><jwt>`; the user is attached to `req.user`.
 */
export class AuthGuard {
  #bearerKey;
  #accessTokens;
  #users;

  constructor({ bearerKey, accessTokens, userRepository }) {
    this.#bearerKey = bearerKey;
    this.#accessTokens = accessTokens;
    this.#users = userRepository;
  }

  /** Middleware for signed-in users; a non-empty `allowedRoles` also restricts by role. */
  authenticate(allowedRoles = []) {
    return asyncHandler(async (req, res, next) => {
      req.user = await this.#resolveUser(req.headers.authorization);
      if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError("Not authorized account");
      }
      return next();
    });
  }

  async #resolveUser(authorization) {
    if (!this.#bearerKey || !authorization?.startsWith(this.#bearerKey)) {
      throw new UnauthorizedError("Invalid bearer key");
    }
    const token = authorization.slice(this.#bearerKey.length).trim();
    if (!token) throw new UnauthorizedError("Missing Token");

    const decoded = this.#accessTokens.verify(token);
    if (!decoded?.id) throw new UnauthorizedError("Invalid payload token");

    const user = await this.#users.findAuthUserById(decoded.id);
    if (!user) throw new UnauthorizedError("Not registered account");
    return user;
  }
}
