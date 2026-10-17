import { env } from "../config/env.js";
import { asyncHandler } from "./error-handler.js";
import { verifyToken } from "../security/token.js";
import userModel from "../modules/users/user.model.js";

/**
 * Requires a valid `Authorization: <BEARER_KEY><jwt>` header and attaches the
 * user to `req.user`. When `allowedRoles` is non-empty, the user's role must be in it.
 */
export const authenticate = (allowedRoles = []) => {
  return asyncHandler(async (req, res, next) => {
    const { authorization } = req.headers;

    if (!env.bearerKey || !authorization?.startsWith(env.bearerKey)) {
      return next(new Error("Invalid bearer key", { cause: 401 }));
    }

    const token = authorization.slice(env.bearerKey.length).trim();
    if (!token) {
      return next(new Error("Missing Token", { cause: 401 }));
    }

    const decoded = verifyToken({ token });
    if (!decoded?.id) {
      return next(new Error("Invalid payload token", { cause: 401 }));
    }

    const user = await userModel
      .findById(decoded.id)
      .select("userName email image role");
    if (!user) {
      return next(new Error("Not registered account", { cause: 401 }));
    }
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      return next(new Error("Not authorized account", { cause: 403 }));
    }

    req.user = user;
    return next();
  });
};
