import { Router } from "express";
import * as validators from "./auth.validation.js";
import { USER_ROLES } from "../users/user.roles.js";
import { validate } from "../../middleware/validate.js";

export function createAuthRouter({ authController, authGuard }) {
  const router = Router();

  router.post("/signup", validate(validators.signup), authController.signup);
  router.post("/login", validate(validators.login), authController.login);
  router.get(
    "/confirmEmail/:token",
    validate(validators.confirmationToken),
    authController.confirmEmail
  );
  router.get(
    "/NewConfirmEmail/:token",
    validate(validators.confirmationToken),
    authController.resendConfirmationEmail
  );
  router.get("/user", authGuard.authenticate([USER_ROLES.Admin]), authController.listUsers);

  return router;
}
