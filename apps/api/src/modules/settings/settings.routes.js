import { Router } from "express";
import { UpdateSettingsDto } from "./settings.dto.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../roles/permissions.js";

export function createSettingsRouter({ settingsController, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.SettingsManage);

  router.get("/", canManage, settingsController.get);
  router.put("/", canManage, validate(UpdateSettingsDto), settingsController.update);

  return router;
}
