import { Router } from "express";
import { crudRouter } from "../../core/crud-routes.js";
import { CrudController } from "../../core/crud-controller.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { fileUpload } from "../../middleware/upload.js";
import { PERMISSIONS } from "../roles/permissions.js";
import {
  CreatePurchaseRequestDto, IdDto, ListPurchaseOrdersDto, PurchaseActionDto, ReceiveDeliveryDto, SupplierDtos, UpdatePurchaseOrderDto,
} from "./acquisition.dto.js";

const send = (status, fn) => asyncHandler(async (req, res) => res.status(status).json({ data: await fn(req) }));

const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

export const createSupplierRouter = ({ supplierService, authGuard }) =>
  crudRouter({
    controller: new CrudController(supplierService),
    dtos: SupplierDtos,
    write: authGuard.requirePermission(PERMISSIONS.AcquisitionsManage),
  });

export function createPurchaseOrderRouter({ purchaseOrderService: service, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.AcquisitionsManage);
  const upload = fileUpload(DOCUMENT_TYPES, { maxBytes: 20 * 1024 * 1024 }).single("file");

  router.get("/", canManage, validate(ListPurchaseOrdersDto), asyncHandler(async (req, res) => res.json(await service.list(req.dto, req.access))));
  router.post("/", canManage, validate(CreatePurchaseRequestDto), send(201, (req) => service.createRequest(req.dto, req.access)));
  router.get("/:id", canManage, validate(IdDto), send(200, (req) => service.get(req.dto.id, req.access)));
  router.patch("/:id", canManage, validate(UpdatePurchaseOrderDto), send(200, (req) => service.update(req.dto, req.access)));
  for (const action of ["approve", "reject", "cancel"]) {
    router.post(`/:id/${action}`, canManage, validate(PurchaseActionDto), send(200, (req) => service[action](req.dto, req.access)));
  }
  router.post("/:id/order", canManage, validate(PurchaseActionDto), send(200, (req) => service.placeOrder(req.dto, req.access)));
  router.post("/:id/deliveries", canManage, validate(ReceiveDeliveryDto), send(200, (req) => service.receive(req.dto, req.access)));
  router.post("/:id/documents", canManage, upload, validate(IdDto), send(201, (req) => service.addDocument(req.dto.id, req.file, req.access)));
  router.get(
    "/:id/documents/:documentId",
    canManage,
    asyncHandler(async (req, res) => {
      const { stream, size, name, mimeType } = await service.openDocument(req.params.id, req.params.documentId, req.access);
      res.set({ "Content-Type": mimeType, "Content-Length": size, "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"` });
      stream.pipe(res);
    })
  );
  return router;
}
