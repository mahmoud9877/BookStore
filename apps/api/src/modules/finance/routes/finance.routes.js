import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { sendData, sendResult } from "../../../middleware/route-handlers.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";
import {
  CardCheckoutDto, CreateFineDto, ListFinesDto, ListPaymentsDto, RecordCashPaymentDto, RefundDto, WaiveFineDto,
} from "../dtos/finance.dto.js";

const P = PERMISSIONS;
export function createFineRouter({ fineService, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(P.FinesManage);

  router.get("/me", authGuard.signedIn(), sendData(200, (req) => fineService.listOwn(req.user._id)));
  router.get("/", authGuard.requirePermission(P.FinesManage, P.PaymentsManage, P.MembersRead), validate(ListFinesDto), sendResult((req) => fineService.list(req.dto, req.access)));
  router.post("/", canManage, validate(CreateFineDto), sendData(201, (req) => fineService.addManual(req.dto, req.access)));
  router.post("/:id/waive", canManage, validate(WaiveFineDto), sendData(200, (req) => fineService.waive(req.dto, req.access)));

  return router;
}

export function createPaymentRouter({ paymentService, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(P.PaymentsManage);

  router.get("/me", authGuard.signedIn(), sendData(200, (req) => paymentService.listOwn(req.user._id)));
  router.post("/me/checkout", authGuard.signedIn(), validate(CardCheckoutDto), sendData(201, (req) => paymentService.startCardCheckout(req.user._id, req.dto)));
  router.get("/", canManage, validate(ListPaymentsDto), sendResult((req) => paymentService.list(req.dto, req.access)));
  router.post(
    "/",
    canManage,
    validate(RecordCashPaymentDto),
    sendData(201, (req) => paymentService.recordCash({ ...req.dto, idempotencyKey: req.dto.idempotencyKey ?? req.get("idempotency-key")?.slice(0, 100) }, req.access))
  );
  router.post("/:id/refund", canManage, validate(RefundDto), sendData(200, (req) => paymentService.refund(req.dto, req.access)));

  return router;
}
