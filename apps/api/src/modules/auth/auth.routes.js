import { Router } from "express";
import * as authController from "./auth.controller.js";
import * as validators from "./auth.validation.js";
import { USER_ROLES } from "../users/user.roles.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";

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
router.get("/user", authenticate([USER_ROLES.Admin]), authController.listUsers);

export default router;
