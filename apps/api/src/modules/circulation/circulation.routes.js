import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { PERMISSIONS } from "../roles/permissions.js";
import {
  CancelReservationDto, CheckoutDto, DeclareLostDto, IdDto, ListLoansDto, ListReservationsDto, OwnLoansDto,
  PlaceReservationDto, ReturnDto, StaffReservationDto,
} from "./circulation.dto.js";

const P = PERMISSIONS;
const send = (status, fn) => asyncHandler(async (req, res) => res.status(status).json({ data: await fn(req) }));
const sendPage = (fn) => asyncHandler(async (req, res) => res.json(await fn(req)));

export function createLoanRouter({ circulationService, authGuard }) {
  const router = Router();
  const desk = authGuard.requirePermission(P.CirculationManage);
  const signedIn = authGuard.signedIn();

  // Self-service (members).
  router.get("/me", signedIn, validate(OwnLoansDto), sendPage((req) => circulationService.listOwn(req.user._id, req.dto)));
  router.post("/me/:id/renew", signedIn, validate(IdDto), send(200, (req) => circulationService.renew(req.dto, req.access, { asMemberUserId: req.user._id })));

  // The desk.
  router.get("/", authGuard.requirePermission(P.CirculationManage, P.MembersRead), validate(ListLoansDto), sendPage((req) => circulationService.list(req.dto, req.access)));
  router.post("/checkout", desk, validate(CheckoutDto), send(201, (req) => circulationService.checkout(req.dto, req.access)));
  router.post("/return", desk, validate(ReturnDto), send(200, (req) => circulationService.checkin(req.dto, req.access)));
  router.get("/:id", authGuard.requirePermission(P.CirculationManage, P.MembersRead), validate(IdDto), send(200, (req) => circulationService.getLoan(req.dto.id)));
  router.post("/:id/renew", desk, validate(IdDto), send(200, (req) => circulationService.renew(req.dto, req.access)));
  router.post("/:id/lost", desk, validate(DeclareLostDto), send(200, (req) => circulationService.declareLost(req.dto, req.access)));

  return router;
}

export function createReservationRouter({ reservationService, authGuard }) {
  const router = Router();
  const staff = authGuard.requirePermission(P.ReservationsManage);
  const signedIn = authGuard.signedIn();

  router.get("/me", signedIn, send(200, (req) => reservationService.listOwn(req.user._id)));
  router.post("/me", signedIn, validate(PlaceReservationDto), send(201, (req) => reservationService.placeOwn(req.user._id, req.dto)));
  router.post("/me/:id/cancel", signedIn, validate(CancelReservationDto), send(200, (req) => reservationService.cancel(req.dto, req.access, { asMemberUserId: req.user._id })));

  router.get("/", authGuard.requirePermission(P.ReservationsManage, P.CirculationManage), validate(ListReservationsDto), sendPage((req) => reservationService.list(req.dto, req.access)));
  router.post("/", staff, validate(StaffReservationDto), send(201, (req) => reservationService.placeForMember(req.dto, req.access)));
  router.get("/:id", authGuard.requirePermission(P.ReservationsManage, P.CirculationManage), validate(IdDto), send(200, (req) => reservationService.get(req.dto.id)));
  router.post("/:id/cancel", staff, validate(CancelReservationDto), send(200, (req) => reservationService.cancel(req.dto, req.access)));

  return router;
}
