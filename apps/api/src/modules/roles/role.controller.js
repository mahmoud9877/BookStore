import { asyncHandler } from "../../middleware/error-handler.js";

export class RoleController {
  #roleService;

  constructor(roleService) {
    this.#roleService = roleService;
  }

  listRoles = asyncHandler(async (req, res) => {
    return res.status(200).json({ roles: await this.#roleService.listRoles() });
  });

  listPermissions = (req, res) => {
    return res.status(200).json({ permissions: this.#roleService.listPermissions() });
  };

  createRole = asyncHandler(async (req, res) => {
    const role = await this.#roleService.createRole(req.dto, req.user);
    return res.status(201).json({ message: "Role created successfully", role });
  });

  updateRole = asyncHandler(async (req, res) => {
    const role = await this.#roleService.updateRole(req.dto, req.user);
    return res.status(200).json({ message: "Role updated successfully", role });
  });

  deleteRole = asyncHandler(async (req, res) => {
    await this.#roleService.deleteRole(req.dto.id, req.user);
    return res.status(200).json({ message: "Role deleted successfully" });
  });
}
