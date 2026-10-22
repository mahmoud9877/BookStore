import joi from "joi";
import { Router } from "express";
import { RequestDto, fields } from "../../core/dto.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { PERMISSIONS } from "../roles/permissions.js";

class InboxDto extends RequestDto {
  static schema = joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    unreadOnly: joi.boolean().default(false),
  });
}

class MarkReadDto extends RequestDto {
  static schema = joi.object({ ids: joi.array().items(fields.objectId()).max(100) });
}

export function createNotificationRouter({ notificationService, authGuard }) {
  const router = Router();
  const signedIn = authGuard.signedIn();

  router.get("/me", signedIn, validate(InboxDto), asyncHandler(async (req, res) => res.json(await notificationService.inbox(req.user._id, req.dto))));
  router.post("/me/read", signedIn, validate(MarkReadDto), asyncHandler(async (req, res) => res.json(await notificationService.markRead(req.user._id, req.dto.ids))));
  router.get(
    "/stats",
    authGuard.requirePermission(PERMISSIONS.SettingsManage, PERMISSIONS.ReportsRead),
    asyncHandler(async (req, res) => res.json({ data: await notificationService.deliveryStats() }))
  );
  return router;
}
