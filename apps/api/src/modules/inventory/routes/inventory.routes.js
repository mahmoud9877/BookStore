import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";
import {
  CloseStocktakeDto,
  ListStocktakesDto,
  ScanDto,
  StartStocktakeDto,
  StocktakeIdDto,
} from "../dtos/stocktake.dto.js";

export function createStocktakeRouter({ inventoryController, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.InventoryManage);

  router.get("/", canManage, validate(ListStocktakesDto), inventoryController.list);
  router.post("/", canManage, validate(StartStocktakeDto), inventoryController.start);
  router.get("/:id", canManage, validate(StocktakeIdDto), inventoryController.get);
  router.post("/:id/scans", canManage, validate(ScanDto), inventoryController.scan);
  router.post("/:id/close", canManage, validate(CloseStocktakeDto), inventoryController.close);
  router.post("/:id/cancel", canManage, validate(StocktakeIdDto), inventoryController.cancel);
  return router;
}
