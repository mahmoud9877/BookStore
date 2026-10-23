import joi from "joi";
import { Router } from "express";
import { RequestDto, fields } from "../../../core/dto.js";
import { validate } from "../../../middleware/validate.js";
import { asyncHandler } from "../../../middleware/error-handler.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";

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

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events for the signed-in user: `unread` on connect and whenever
 * the count changes, `notification` for each new in-app notification, and a
 * `: ping` comment every 25 s. Fed by the NotificationHub.
 */
export function streamNotifications({ notificationHub, heartbeatMs = HEARTBEAT_MS }) {
  return async (req, res) => {
    const userId = req.user._id;
    // A stream stays open: no socket timeout, no buffering by proxies.
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let open = true;
    const write = (chunk) => {
      if (open && !res.writableEnded) res.write(chunk);
    };
    const send = (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const unsubscribe = notificationHub.subscribe(userId, { send, close: () => res.end() });
    const heartbeat = setInterval(() => write(": ping\n\n"), heartbeatMs);
    res.on("close", () => {
      open = false;
      clearInterval(heartbeat);
      unsubscribe();
    });

    try {
      send("unread", { unread: await notificationHub.unreadCount(userId) });
    } catch (error) {
      console.error(`[notifications] unread count failed: ${error.message}`);
    }
  };
}

export function createNotificationRouter({ notificationService, notificationHub, authGuard }) {
  const router = Router();
  const signedIn = authGuard.signedIn();

  router.get("/stream", signedIn, streamNotifications({ notificationHub }));
  router.get("/me", signedIn, validate(InboxDto), asyncHandler(async (req, res) => res.json(await notificationService.inbox(req.user._id, req.dto))));
  router.post("/me/read", signedIn, validate(MarkReadDto), asyncHandler(async (req, res) => res.json(await notificationService.markRead(req.user._id, req.dto.ids))));
  router.get(
    "/stats",
    authGuard.requirePermission(PERMISSIONS.SettingsManage, PERMISSIONS.ReportsRead),
    asyncHandler(async (req, res) => res.json({ data: await notificationService.deliveryStats() }))
  );
  return router;
}
