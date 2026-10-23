import joi from "joi";
import { RequestDto, ResponseDto, crudDtos, fields } from "../../../core/dto.js";
import { paginationKeys } from "../../../core/pagination.js";
import { BOOKING_STATUSES, EVENT_STATUSES } from "../models/facility.model.js";

export const RoomDtos = crudDtos({
  attributes: {
    branch: fields.ref(),
    name: joi.string().trim().max(100),
    kind: joi.string().valid("study", "reading", "meeting", "event"),
    capacity: joi.number().integer().min(1).max(1000),
    features: joi.array().items(joi.string().trim().max(50)).max(20),
    isActive: joi.boolean(),
  },
  required: ["branch", "name", "capacity"],
  filters: { branch: fields.ref(), kind: joi.string(), isActive: joi.boolean() },
});

export class RoomResponseDto extends ResponseDto {
  static fields = ["_id", "branch", "name", "kind", "capacity", "features", "isActive"];
}

export class AvailabilityDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), from: joi.date().required(), to: joi.date().greater(joi.ref("from")).required() });
}

export class BookRoomDto extends RequestDto {
  static schema = joi.object({
    room: fields.objectId(),
    startAt: joi.date().required(),
    endAt: joi.date().greater(joi.ref("startAt")).required(),
    purpose: joi.string().trim().max(300).allow(""),
    member: fields.ref(),
  });
}

export class CancelDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), reason: joi.string().trim().max(300).allow("") });
}

export class ListBookingsDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["startAt"], "startAt"),
    room: fields.ref(),
    branch: fields.ref(),
    from: joi.date(),
    to: joi.date(),
    status: joi.string().valid(...Object.values(BOOKING_STATUSES)),
  });
}

export class BookingResponseDto extends ResponseDto {
  static fields = ["_id", "room", "branch", "member", "event", "startAt", "endAt", "purpose", "status", "cancelledAt", "cancelReason", "createdAt"];
}

export const EventDtos = crudDtos({
  attributes: {
    branch: fields.ref(),
    room: fields.ref().allow(null),
    title: joi.string().trim().max(200),
    description: joi.string().trim().max(5000).allow(""),
    startAt: joi.date(),
    endAt: joi.date(),
    capacity: joi.number().integer().min(1).max(10_000),
    isPublic: joi.boolean(),
  },
  required: ["branch", "title", "startAt", "endAt", "capacity"],
  filters: { branch: fields.ref(), upcoming: joi.boolean(), status: joi.string().valid(...Object.values(EVENT_STATUSES)) },
  sortable: ["startAt", "createdAt"],
  defaultSort: "startAt",
});

export class EventResponseDto extends ResponseDto {
  static fields = ["_id", "branch", "room", "title", "description", "startAt", "endAt", "capacity", "registered", "status", "isPublic"];
}
