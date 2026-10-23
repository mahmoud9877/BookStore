import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";
import { AdjustCopyStatusDto, BarcodeDto, CopyIdDto, CreateCopiesDto, ListCopiesDto, UpdateCopyDto } from "../dtos/copy.dto.js";

const P = PERMISSIONS;

export function createCopyRouter({ copyController, authGuard }) {
  const router = Router();
  const canRead = authGuard.requirePermission(P.CopiesManage, P.CirculationManage, P.InventoryManage, P.ReservationsManage);
  const canManage = authGuard.requirePermission(P.CopiesManage);

  router.get("/", canRead, validate(ListCopiesDto), copyController.list);
  // Must come before "/:id".
  router.get("/barcode/:barcode", canRead, validate(BarcodeDto), copyController.getByBarcode);
  router.get("/:id", canRead, validate(CopyIdDto), copyController.get);
  router.post("/", canManage, validate(CreateCopiesDto), copyController.create);
  router.patch("/:id", canManage, validate(UpdateCopyDto), copyController.update);
  router.post(
    "/:id/status",
    authGuard.requirePermission(P.InventoryManage, P.CopiesManage),
    validate(AdjustCopyStatusDto),
    copyController.adjustStatus
  );

  return router;
}
