import { Router } from "express";
import { PERMISSIONS } from "./permissions.js";
import { CreateRoleDto, RoleIdDto, UpdateRoleDto } from "./role.dto.js";
import { validate } from "../../middleware/validate.js";

export function createRoleRouter({ roleController, authGuard }) {
  const router = Router();
  // Assigning roles to users needs the list too.
  const canReadRoles = authGuard.requirePermission(PERMISSIONS.RolesManage, PERMISSIONS.UsersManage);
  const canManageRoles = authGuard.requirePermission(PERMISSIONS.RolesManage);

  router.get("/", canReadRoles, roleController.listRoles);
  // Must be registered before "/:id", otherwise "permissions" is treated as an id.
  router.get("/permissions", canReadRoles, roleController.listPermissions);

  router.post("/", canManageRoles, validate(CreateRoleDto), roleController.createRole);
  router.put("/:id", canManageRoles, validate(UpdateRoleDto), roleController.updateRole);
  router.delete("/:id", canManageRoles, validate(RoleIdDto), roleController.deleteRole);

  return router;
}
