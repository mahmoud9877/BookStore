import joi from "joi";
import { BaseRepository } from "../../core/base-repository.js";
import { CrudService } from "../../core/crud-service.js";
import { RequestDto, ResponseDto, crudDtos, fields } from "../../core/dto.js";
import { pageOf, paginationKeys, toSort } from "../../core/pagination.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ensureFound } from "../../core/http-errors.js";
import { MemberPolicy } from "../members/member-policy.js";
import { BOOKING_STATUSES, EVENT_STATUSES, eventModel, eventRegistrationModel, roomBookingModel, roomModel } from "./facility.model.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export class RoomRepository extends BaseRepository { constructor(model = roomModel) { super(model); } }
export class RoomBookingRepository extends BaseRepository {
  constructor(model = roomBookingModel) { super(model); }

  /** Confirmed bookings of `roomId` overlapping [startAt, endAt). */
  findOverlap(roomId, startAt, endAt, exceptId) {
    return this.findOne({ room: roomId, status: BOOKING_STATUSES.confirmed, startAt: { $lt: endAt }, endAt: { $gt: startAt }, ...(exceptId && { _id: { $ne: exceptId } }) });
  }
}
export class EventRepository extends BaseRepository { constructor(model = eventModel) { super(model); } }
export class EventRegistrationRepository extends BaseRepository { constructor(model = eventRegistrationModel) { super(model); } }

// ---------- DTOs

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
    member: fields.ref(), // staff booking on a member's behalf
  });
}

export class CancelDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), reason: joi.string().trim().max(300).allow("") });
}

export class ListBookingsDto extends RequestDto {
  static schema = joi.object({ ...paginationKeys(["startAt"], "startAt"), room: fields.ref(), branch: fields.ref(), from: joi.date(), to: joi.date(), status: joi.string().valid(...Object.values(BOOKING_STATUSES)) });
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

// ---------- Services

export class RoomService extends CrudService {
  static entity = "Room";
  static Dto = RoomResponseDto;
  populate = [{ path: "branch", select: "code name" }];

  #bookings;

  constructor({ roomRepository, roomBookingRepository, auditService }) {
    super({ repository: roomRepository, auditService });
    this.#bookings = roomBookingRepository;
  }

  async beforeWrite(data, existing, actor) {
    if (existing) actor.assertBranch(existing.branch);
    if (data.branch) actor.assertBranch(data.branch);
  }

  async beforeDelete(room, actor) {
    actor.assertBranch(room.branch);
    if (await this.#bookings.countWhere({ room: room._id, status: BOOKING_STATUSES.confirmed, endAt: { $gt: new Date() } })) {
      throw new ConflictError("This room has upcoming bookings. Deactivate it instead.");
    }
  }

  /** Busy intervals of a room in a window (no member details: public). */
  async availability({ id, from, to }) {
    ensureFound(await this.repository.findById(id), "Room not found");
    const busy = await this.#bookings.findMany(
      { room: id, status: BOOKING_STATUSES.confirmed, startAt: { $lt: to }, endAt: { $gt: from } },
      { sort: { startAt: 1 }, select: "startAt endAt event", limit: 500 }
    );
    return busy.map(({ startAt, endAt, event }) => ({ startAt, endAt, isEvent: Boolean(event) }));
  }
}

/**
 * Room bookings with conflict prevention: each booking transaction bumps the
 * room's version, so overlapping bookings serialise and the second one sees the first.
 */
export class RoomBookingService {
  #rooms;
  #bookings;
  #members;
  #settings;
  #transactions;
  #audit;

  constructor({ roomRepository, roomBookingRepository, memberRepository, settingsService, transactionRunner, auditService }) {
    this.#rooms = roomRepository;
    this.#bookings = roomBookingRepository;
    this.#members = memberRepository;
    this.#settings = settingsService;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  async bookOwn(userId, dto) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    return this.#book({ ...dto, member: member._id }, member, { userId, userName: member.name }, { enforcePolicy: true });
  }

  /** Staff may book for a member or for the library itself (no member); policy limits do not apply. */
  async bookForStaff(dto, actor) {
    const member = dto.member ? ensureFound(await this.#members.findWithType(dto.member), "Member not found") : null;
    return this.#book(dto, member, actor, { enforcePolicy: false });
  }

  async #book({ room: roomId, startAt, endAt, purpose, event = null }, member, actor, { enforcePolicy }) {
    const room = ensureFound(await this.#rooms.findById(roomId), "Room not found");
    if (!room.isActive) throw new BadRequestError("This room cannot be booked");
    if (!enforcePolicy) actor.assertBranch(room.branch);
    if (member) MemberPolicy.assertInGoodStanding(member);
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (start < new Date()) throw new BadRequestError("Bookings cannot start in the past");
    if (enforcePolicy) {
      const { rooms } = await this.#settings.get();
      if (end - start > rooms.maxBookingHours * HOUR_MS) throw new BadRequestError(`Bookings are limited to ${rooms.maxBookingHours} hour(s)`);
      if (start - Date.now() > rooms.maxAdvanceDays * DAY_MS) throw new BadRequestError(`Rooms can be booked at most ${rooms.maxAdvanceDays} day(s) ahead`);
    }

    const booking = await this.#transactions.run(async () => {
      await this.#rooms.updateWhere({ _id: room._id }, { $inc: { bookingVersion: 1 } });
      if (await this.#bookings.findOverlap(room._id, start, end)) throw new ConflictError("The room is already booked at that time");
      const created = await this.#bookings.create({
        room: room._id, branch: room.branch, member: member?._id ?? null, event, startAt: start, endAt: end, purpose, bookedBy: actor.userId ?? null,
      });
      await this.#audit.record(actor, { action: "room.book", entity: "RoomBooking", entityId: created._id, branch: room.branch, after: { room: room.name, startAt: start, endAt: end } });
      return created;
    });
    return BookingResponseDto.from(booking);
  }

  /** Members cancel their own bookings up to the cutoff; staff any booking of their branches. */
  async cancel({ id, reason }, actor, { asMemberUserId } = {}) {
    const booking = ensureFound(await this.#bookings.findById(id), "Booking not found");
    if (asMemberUserId) {
      const member = await this.#members.findByUser(asMemberUserId);
      if (!member || String(member._id) !== String(booking.member)) throw new NotFoundError("Booking not found");
      const { rooms } = await this.#settings.get();
      if (new Date(booking.startAt) - Date.now() < rooms.cancellationCutoffHours * HOUR_MS) {
        throw new ForbiddenError(`Bookings can be cancelled up to ${rooms.cancellationCutoffHours} hour(s) before they start`);
      }
    } else {
      actor.assertBranch(booking.branch);
    }
    const cancelled = await this.#bookings.updateWhere(
      { _id: id, status: BOOKING_STATUSES.confirmed },
      { $set: { status: BOOKING_STATUSES.cancelled, cancelledAt: new Date(), cancelReason: reason } }
    );
    if (!cancelled) throw new BadRequestError("This booking is already cancelled");
    await this.#audit.record(asMemberUserId ? { userId: asMemberUserId } : actor, { action: "room.cancel", entity: "RoomBooking", entityId: id, branch: booking.branch, reason });
    return BookingResponseDto.from(cancelled);
  }

  async list({ page, limit, sort, room, branch, from, to, status }, actor) {
    const filter = { ...actor.branchFilter("branch") };
    if (room) filter.room = room;
    if (branch) filter.branch = branch;
    if (status) filter.status = status;
    if (from || to) filter.startAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const result = await this.#bookings.paginate(filter, { page, limit, sort: toSort(sort), populate: [{ path: "room", select: "name" }, { path: "member", select: "memberNumber name" }] });
    return pageOf({ ...result, items: BookingResponseDto.fromList(result.items) }, { page, limit });
  }

  async listOwn(userId) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    const bookings = await this.#bookings.findMany({ member: member._id }, { sort: { startAt: -1 }, limit: 100, populate: [{ path: "room", select: "name" }, { path: "branch", select: "name" }] });
    return BookingResponseDto.fromList(bookings);
  }
}

/** Events with capacity-limited registration. An event in a room also books the room. */
export class EventService extends CrudService {
  static entity = "Event";
  static searchFields = ["title"];
  static Dto = EventResponseDto;
  populate = [{ path: "branch", select: "code name" }, { path: "room", select: "name" }];

  #registrations;
  #members;
  #bookings;
  #roomBookings;
  #transactions;

  constructor({ eventRepository, eventRegistrationRepository, memberRepository, roomBookingRepository, roomBookingService, transactionRunner, auditService }) {
    super({ repository: eventRepository, auditService });
    this.#registrations = eventRegistrationRepository;
    this.#members = memberRepository;
    this.#bookings = roomBookingRepository;
    this.#roomBookings = roomBookingService;
    this.#transactions = transactionRunner;
  }

  /** Public listing of upcoming public events. */
  async listPublic({ page, limit }) {
    const filter = { status: EVENT_STATUSES.scheduled, isPublic: true, endAt: { $gt: new Date() } };
    const result = await this.repository.paginate(filter, { page, limit, sort: { startAt: 1, _id: 1 }, populate: this.populate });
    return pageOf({ ...result, items: EventResponseDto.fromList(result.items) }, { page, limit });
  }

  async list({ upcoming, ...query }, actor) {
    return super.list({ ...query, ...(upcoming && { endAt: { $gt: new Date() } }) }, actor);
  }

  scopeFilter(actor) {
    return actor.branchFilter("branch");
  }

  async create(data, actor) {
    actor.assertBranch(data.branch);
    if (new Date(data.endAt) <= new Date(data.startAt)) throw new BadRequestError("An event must end after it starts");
    return this.#transactions.run(async () => {
      const event = await super.create(data, actor);
      if (data.room) await this.#roomBookings.bookForStaff({ room: data.room, startAt: data.startAt, endAt: data.endAt, purpose: data.title, event: event._id }, actor);
      return event;
    });
  }

  async beforeWrite(data, existing, actor) {
    if (existing) {
      actor.assertBranch(existing.branch);
      if (data.capacity !== undefined && data.capacity < existing.registered) {
        throw new BadRequestError(`${existing.registered} member(s) are already registered`);
      }
      if (data.room !== undefined || data.startAt || data.endAt) {
        throw new BadRequestError("Cancel and recreate an event to change its room or time");
      }
    }
  }

  async beforeDelete() {
    throw new BadRequestError("Events are cancelled, not deleted");
  }

  async cancelEvent({ id, reason }, actor) {
    const event = ensureFound(await this.repository.findById(id), "Event not found");
    actor.assertBranch(event.branch);
    await this.#transactions.run(async () => {
      const cancelled = await this.repository.updateWhere({ _id: id, status: EVENT_STATUSES.scheduled }, { $set: { status: EVENT_STATUSES.cancelled } });
      if (!cancelled) throw new BadRequestError("This event is already cancelled");
      await this.#bookings.updateMany({ event: id, status: BOOKING_STATUSES.confirmed }, { $set: { status: BOOKING_STATUSES.cancelled, cancelledAt: new Date(), cancelReason: "Event cancelled" } });
      await this.audit.record(actor, { action: "event.cancel", entity: "Event", entityId: id, branch: event.branch, reason });
    });
    return this.get(id);
  }

  /** Registers the signed-in member; the capacity check and increment are one atomic update. */
  async register(eventId, userId) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    MemberPolicy.assertInGoodStanding(member);
    return this.#transactions.run(async () => {
      const existing = await this.#registrations.findOne({ event: eventId, member: member._id, status: "registered" });
      if (existing) throw new ConflictError("You are already registered");
      const event = await this.repository.updateWhere(
        { _id: eventId, status: EVENT_STATUSES.scheduled, startAt: { $gt: new Date() }, $expr: { $lt: ["$registered", "$capacity"] } },
        { $inc: { registered: 1 } }
      );
      if (!event) throw new ConflictError("This event is full, cancelled or already started");
      await this.#registrations.create({ event: eventId, member: member._id });
      return EventResponseDto.from(event);
    });
  }

  async unregister(eventId, userId) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    return this.#transactions.run(async () => {
      const registration = await this.#registrations.updateWhere({ event: eventId, member: member._id, status: "registered" }, { $set: { status: "cancelled" } });
      if (!registration) throw new NotFoundError("You are not registered for this event");
      const event = await this.repository.updateWhere({ _id: eventId, registered: { $gt: 0 } }, { $inc: { registered: -1 } });
      return EventResponseDto.from(event);
    });
  }

  async listOwnRegistrations(userId) {
    const member = await this.#members.findByUser(userId);
    if (!member) return [];
    const registrations = await this.#registrations.findMany({ member: member._id, status: "registered" }, { sort: { createdAt: -1 }, limit: 100, populate: { path: "event", populate: { path: "branch", select: "name" } } });
    return registrations.map((registration) => EventResponseDto.from(registration.event)).filter(Boolean);
  }
}
