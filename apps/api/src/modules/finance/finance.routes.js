import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { PERMISSIONS } from "../roles/permissions.js";
import {
  CardCheckoutDto, CreateFineDto, ListFinesDto, ListPaymentsDto, RecordCashPaymentDto, RefundDto, WaiveFineDto,
} from "./finance.dto.js";

const P = PERMISSIONS;
const send = (status, fn) => asyncHandler(async (req, res) => res.status(status).json({ data: await fn(req) }));
const sendPage = (fn) => asyncHandler(async (req, res) => res.json(await fn(req)));

export function createFineRouter({ fineService, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(P.FinesManage);

  router.get("/me", authGuard.signedIn(), send(200, (req) => fineService.listOwn(req.user._id)));
  router.get("/", authGuard.requirePermission(P.FinesManage, P.PaymentsManage, P.MembersRead), validate(ListFinesDto), sendPage((req) => fineService.list(req.dto, req.access)));
  router.post("/", canManage, validate(CreateFineDto), send(201, (req) => fineService.addManual(req.dto, req.access)));
  router.post("/:id/waive", canManage, validate(WaiveFineDto), send(200, (req) => fineService.waive(req.dto, req.access)));

  return router;
}

export function createPaymentRouter({ paymentService, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(P.PaymentsManage);

  router.get("/me", authGuard.signedIn(), send(200, (req) => paymentService.listOwn(req.user._id)));
  router.post("/me/checkout", authGuard.signedIn(), validate(CardCheckoutDto), send(201, (req) => paymentService.startCardCheckout(req.user._id, req.dto)));
  router.get("/", canManage, validate(ListPaymentsDto), sendPage((req) => paymentService.list(req.dto, req.access)));
  router.post(
    "/",
    canManage,
    validate(RecordCashPaymentDto),
    send(201, (req) => paymentService.recordCash({ ...req.dto, idempotencyKey: req.dto.idempotencyKey ?? req.get("idempotency-key")?.slice(0, 100) }, req.access))
  );
  router.post("/:id/refund", canManage, validate(RefundDto), send(200, (req) => paymentService.refund(req.dto, req.access)));

  return router;
}
