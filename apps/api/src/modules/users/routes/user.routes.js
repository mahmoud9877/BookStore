import { Router } from "express";
import { ChangeUserRoleDto, ListUsersDto, UpdateUserAccessDto } from "../dtos/user.dto.js";
import { validate } from "../../../middleware/validate.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";

/** Mounted under /auth: GET /auth/user is the established public path. */
export function createUserRouter({ userController, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.UsersManage);

  router.get("/me", authGuard.signedIn(), userController.getCurrentUser);
  router.get(
    "/user",
    authGuard.requirePermission(PERMISSIONS.UsersRead, PERMISSIONS.UsersManage),
    validate(ListUsersDto),
    userController.listUsers
  );
  router.patch("/user/:id/role", canManage, validate(ChangeUserRoleDto), userController.changeRole);
  router.patch("/user/:id/access", canManage, validate(UpdateUserAccessDto), userController.updateAccess);

  return router;
}
