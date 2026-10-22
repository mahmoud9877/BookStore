import joi from "joi";
import { Router } from "express";
import { crudRouter } from "../../core/crud-routes.js";
import { CrudController } from "../../core/crud-controller.js";
import { RequestDto, fields } from "../../core/dto.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { PERMISSIONS } from "../roles/permissions.js";
import { AvailabilityDto, BookRoomDto, CancelDto, EventDtos, ListBookingsDto, RoomDtos } from "./facility.service.js";

const send = (status, fn) => asyncHandler(async (req, res) => res.status(status).json({ data: await fn(req) }));
const passThrough = (req, res, next) => next();

class EventIdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}
class PublicEventsDto extends RequestDto {
  static schema = joi.object({ page: joi.number().integer().min(1).default(1), limit: joi.number().integer().min(1).max(100).default(20) });
}

export function createRoomRouter({ roomService, roomBookingService, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.FacilitiesManage);
  const signedIn = authGuard.signedIn();

  // Bookings (registered before the room CRUD routes so "/bookings" is not an id).
  router.get("/bookings/me", signedIn, send(200, (req) => roomBookingService.listOwn(req.user._id)));
  router.post("/bookings/me", signedIn, validate(BookRoomDto), send(201, (req) => roomBookingService.bookOwn(req.user._id, req.dto)));
  router.post("/bookings/me/:id/cancel", signedIn, validate(CancelDto), send(200, (req) => roomBookingService.cancel(req.dto, req.access, { asMemberUserId: req.user._id })));
  router.get("/bookings", canManage, validate(ListBookingsDto), asyncHandler(async (req, res) => res.json(await roomBookingService.list(req.dto, req.access))));
  router.post("/bookings", canManage, validate(BookRoomDto), send(201, (req) => roomBookingService.bookForStaff(req.dto, req.access)));
  router.post("/bookings/:id/cancel", canManage, validate(CancelDto), send(200, (req) => roomBookingService.cancel(req.dto, req.access)));

  // Rooms: listing and availability are public, so members can choose.
  router.get("/:id/availability", validate(AvailabilityDto), send(200, (req) => roomService.availability(req.dto)));
  router.use(crudRouter({ controller: new CrudController(roomService), dtos: RoomDtos, write: canManage, read: passThrough }));
  return router;
}

export function createEventRouter({ eventService, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.FacilitiesManage);
  const signedIn = authGuard.signedIn();

  router.get("/public", validate(PublicEventsDto), asyncHandler(async (req, res) => res.json(await eventService.listPublic(req.dto))));
  router.get("/me", signedIn, send(200, (req) => eventService.listOwnRegistrations(req.user._id)));
  router.post("/:id/register", signedIn, validate(EventIdDto), send(200, (req) => eventService.register(req.dto.id, req.user._id)));
  router.post("/:id/unregister", signedIn, validate(EventIdDto), send(200, (req) => eventService.unregister(req.dto.id, req.user._id)));
  router.post("/:id/cancel", canManage, validate(CancelDto), send(200, (req) => eventService.cancelEvent(req.dto, req.access)));
  router.use(crudRouter({ controller: new CrudController(eventService), dtos: EventDtos, write: canManage }));
  return router;
}
