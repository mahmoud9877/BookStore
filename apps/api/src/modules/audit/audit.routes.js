import { Router } from "express";
import { ListAuditLogsDto } from "./audit.dto.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../roles/permissions.js";

export function createAuditRouter({ auditController, authGuard }) {
  const router = Router();
  router.get("/", authGuard.requirePermission(PERMISSIONS.AuditRead), validate(ListAuditLogsDto), auditController.list);
  return router;
}
