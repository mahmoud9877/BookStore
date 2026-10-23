import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { asyncHandler } from "../../../middleware/error-handler.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";
import { CreateTransferDto, ListTransfersDto, TransferActionDto } from "../services/transfer.service.js";

export function createTransferRouter({ transferService, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.InventoryManage);
  const json = (fn) => asyncHandler(async (req, res) => res.json({ data: await fn(req) }));

  router.get("/", canManage, validate(ListTransfersDto), asyncHandler(async (req, res) => res.json(await transferService.list(req.dto, req.access))));
  router.post("/", canManage, validate(CreateTransferDto), asyncHandler(async (req, res) => res.status(201).json({ data: await transferService.create(req.dto, req.access) })));
  router.post("/:id/ship", canManage, validate(TransferActionDto), json((req) => transferService.ship(req.dto, req.access)));
  // Receiving happens at the desk too (copies arriving for reservations).
  router.post(
    "/:id/receive",
    authGuard.requirePermission(PERMISSIONS.InventoryManage, PERMISSIONS.CirculationManage),
    validate(TransferActionDto),
    json((req) => transferService.receive(req.dto, req.access))
  );
  router.post("/:id/cancel", canManage, validate(TransferActionDto), json((req) => transferService.cancel(req.dto, req.access)));
  return router;
}
