import { Router } from "express";
import { ConfirmationTokenDto, LoginDto, RegisterUserDto } from "../dtos/auth.dto.js";
import { validate } from "../../../middleware/validate.js";
import { ForbiddenError } from "../../../core/http-errors.js";

export function createAuthRouter({ authController, config }) {
  const router = Router();

  const trustedOrigin = (req, res, next) => {
    const origin = req.get("origin");
    if (!origin && !config.isProduction) return next();
    const allowed = new Set([
      ...(config.corsOrigins ?? []),
      ...(config.frontendUrl ? [new URL(config.frontendUrl).origin] : []),
      `${req.protocol}://${req.get("host")}`,
    ]);
    if (!origin || !allowed.has(origin)) return next(new ForbiddenError("Untrusted request origin"));
    return next();
  };

  router.post("/signup", validate(RegisterUserDto), authController.signup);
  router.post("/login", validate(LoginDto), authController.login);
  router.post("/refresh", trustedOrigin, authController.refresh);
  router.post("/logout", trustedOrigin, authController.logout);
  router.get(
    "/confirmEmail/:token",
    validate(ConfirmationTokenDto),
    authController.confirmEmail
  );
  router.get(
    "/NewConfirmEmail/:token",
    validate(ConfirmationTokenDto),
    authController.resendConfirmationEmail
  );

  return router;
}
