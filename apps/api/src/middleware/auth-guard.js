import { asyncHandler } from "./error-handler.js";
import { AccessContext } from "../core/access-context.js";
import { ForbiddenError, UnauthorizedError } from "../core/http-errors.js";

/**
 * Builds authentication middleware. Requests must send
 * `Authorization: <bearerKey><jwt>`; the user is attached to `req.user` and
 * what they may do to `req.access` (an AccessContext).
 * Permissions come from the user's role and are looked up on every request, so
 * a role change or deactivation applies immediately, without signing in again.
 */
export class AuthGuard {
  #bearerKey;
  #accessTokens;
  #users;
  #roles;

  constructor({ bearerKey, accessTokens, userRepository, roleService }) {
    this.#bearerKey = bearerKey;
    this.#accessTokens = accessTokens;
    this.#users = userRepository;
    this.#roles = roleService;
  }

  /** Any signed-in user. */
  signedIn() {
    return asyncHandler(async (req, res, next) => {
      await this.#authenticate(req);
      return next();
    });
  }

  /** Authenticates when credentials are sent; anonymous requests pass with no `req.user`. */
  optional() {
    return asyncHandler(async (req, res, next) => {
      if (req.headers.authorization) await this.#authenticate(req);
      return next();
    });
  }

  /** Signed-in users whose role grants at least one of `permissions`. */
  requirePermission(...permissions) {
    return asyncHandler(async (req, res, next) => {
      await this.#authenticate(req);
      if (!req.access.can(...permissions)) throw new ForbiddenError("Not authorized account");
      return next();
    });
  }

  async #authenticate(req) {
    const user = await this.#resolveUser(req.headers.authorization);
    const { permissions, branchScope } = await this.#roles.accessFor(user.role);
    req.user = user;
    req.access = new AccessContext({
      userId: user._id,
      userName: user.userName,
      role: user.role,
      permissions,
      branchScope,
      branches: user.branches ?? [],
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
    if (user.isActive === false) throw new UnauthorizedError("This account has been deactivated");
    return user;
  }
}
