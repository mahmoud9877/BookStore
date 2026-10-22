import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { PERMISSIONS } from "../roles/permissions.js";
import { CloseStocktakeDto, ListStocktakesDto, ScanDto, StartStocktakeDto, StocktakeIdDto } from "./stocktake.service.js";

const send = (status, fn) => asyncHandler(async (req, res) => res.status(status).json({ data: await fn(req) }));

export function createStocktakeRouter({ stocktakeService: service, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.InventoryManage);
  router.get("/", canManage, validate(ListStocktakesDto), asyncHandler(async (req, res) => res.json(await service.list(req.dto, req.access))));
  router.post("/", canManage, validate(StartStocktakeDto), send(201, (req) => service.start(req.dto, req.access)));
  router.get("/:id", canManage, validate(StocktakeIdDto), send(200, (req) => service.get(req.dto.id, req.access)));
  router.post("/:id/scans", canManage, validate(ScanDto), send(200, (req) => service.scan(req.dto, req.access)));
  router.post("/:id/close", canManage, validate(CloseStocktakeDto), send(200, (req) => service.close(req.dto, req.access)));
  router.post("/:id/cancel", canManage, validate(StocktakeIdDto), send(200, (req) => service.cancel(req.dto, req.access)));
  return router;
}
