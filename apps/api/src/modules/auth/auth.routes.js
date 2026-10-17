import { Router } from "express";
import { ConfirmationTokenDto, LoginDto, RegisterUserDto } from "./auth.dto.js";
import { USER_ROLES } from "../users/user.roles.js";
import { validate } from "../../middleware/validate.js";

export function createAuthRouter({ authController, authGuard }) {
  const router = Router();

  router.post("/signup", validate(RegisterUserDto), authController.signup);
  router.post("/login", validate(LoginDto), authController.login);
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
  router.get("/user", authGuard.authenticate([USER_ROLES.Admin]), authController.listUsers);

  return router;
}
