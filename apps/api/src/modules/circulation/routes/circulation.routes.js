import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { sendData, sendResult } from "../../../middleware/route-handlers.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";
import {
  CancelReservationDto, CheckoutDto, DeclareLostDto, IdDto, ListLoansDto, ListReservationsDto, OwnLoansDto,
  PlaceReservationDto, ReturnDto, StaffReservationDto,
} from "../dtos/circulation.dto.js";

const P = PERMISSIONS;
export function createLoanRouter({ circulationService, authGuard }) {
  const router = Router();
  const desk = authGuard.requirePermission(P.CirculationManage);
  const signedIn = authGuard.signedIn();

  // Self-service (members).
  router.get("/me", signedIn, validate(OwnLoansDto), sendResult((req) => circulationService.listOwn(req.user._id, req.dto)));
  router.post("/me/:id/renew", signedIn, validate(IdDto), sendData(200, (req) => circulationService.renew(req.dto, req.access, { asMemberUserId: req.user._id })));

  // The desk.
  router.get("/", authGuard.requirePermission(P.CirculationManage, P.MembersRead), validate(ListLoansDto), sendResult((req) => circulationService.list(req.dto, req.access)));
  router.post("/checkout", desk, validate(CheckoutDto), sendData(201, (req) => circulationService.checkout(req.dto, req.access)));
  router.post("/return", desk, validate(ReturnDto), sendData(200, (req) => circulationService.checkin(req.dto, req.access)));
  router.get("/:id", authGuard.requirePermission(P.CirculationManage, P.MembersRead), validate(IdDto), sendData(200, (req) => circulationService.getLoan(req.dto.id)));
  router.post("/:id/renew", desk, validate(IdDto), sendData(200, (req) => circulationService.renew(req.dto, req.access)));
  router.post("/:id/lost", desk, validate(DeclareLostDto), sendData(200, (req) => circulationService.declareLost(req.dto, req.access)));

  return router;
}

export function createReservationRouter({ reservationService, authGuard }) {
  const router = Router();
  const staff = authGuard.requirePermission(P.ReservationsManage);
  const signedIn = authGuard.signedIn();

  router.get("/me", signedIn, sendData(200, (req) => reservationService.listOwn(req.user._id)));
  router.post("/me", signedIn, validate(PlaceReservationDto), sendData(201, (req) => reservationService.placeOwn(req.user._id, req.dto)));
  router.post("/me/:id/cancel", signedIn, validate(CancelReservationDto), sendData(200, (req) => reservationService.cancel(req.dto, req.access, { asMemberUserId: req.user._id })));

  router.get("/", authGuard.requirePermission(P.ReservationsManage, P.CirculationManage), validate(ListReservationsDto), sendResult((req) => reservationService.list(req.dto, req.access)));
  router.post("/", staff, validate(StaffReservationDto), sendData(201, (req) => reservationService.placeForMember(req.dto, req.access)));
  router.get("/:id", authGuard.requirePermission(P.ReservationsManage, P.CirculationManage), validate(IdDto), sendData(200, (req) => reservationService.get(req.dto.id)));
  router.post("/:id/cancel", staff, validate(CancelReservationDto), sendData(200, (req) => reservationService.cancel(req.dto, req.access)));

  return router;
}
