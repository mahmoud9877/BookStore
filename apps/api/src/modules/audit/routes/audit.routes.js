import { Router } from "express";
import { ListAuditLogsDto } from "../dtos/audit.dto.js";
import { validate } from "../../../middleware/validate.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";

export function createAuditRouter({ auditController, authGuard }) {
  const router = Router();
  router.get("/", authGuard.requirePermission(PERMISSIONS.AuditRead), validate(ListAuditLogsDto), auditController.list);
  return router;
}
