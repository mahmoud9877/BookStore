import { Router } from "express";
import { AskDto } from "./assistant.service.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";

export function createAssistantRouter({ catalogAssistantService: service, rateLimiter }) {
  const router = Router();
  router.get("/status", (req, res) => res.json({ data: { ai: service.isAiEnabled } }));
  // Public, but rate limited per client: every question may cost two model calls.
  router.post("/ask", rateLimiter, validate(AskDto), asyncHandler(async (req, res) => res.json({ data: await service.ask(req.dto) })));
  return router;
}
