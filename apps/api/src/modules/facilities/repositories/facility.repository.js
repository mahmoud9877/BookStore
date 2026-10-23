import { BaseRepository } from "../../../core/base-repository.js";
import { BOOKING_STATUSES, eventModel, eventRegistrationModel, roomBookingModel, roomModel } from "../models/facility.model.js";

export class RoomRepository extends BaseRepository {
  constructor(model = roomModel) {
    super(model);
  }
}

export class RoomBookingRepository extends BaseRepository {
  constructor(model = roomBookingModel) {
    super(model);
  }

  findOverlap(roomId, startAt, endAt, exceptId) {
    return this.findOne({
      room: roomId,
      status: BOOKING_STATUSES.confirmed,
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
      ...(exceptId && { _id: { $ne: exceptId } }),
    });
  }
}

export class EventRepository extends BaseRepository {
  constructor(model = eventModel) {
    super(model);
  }
}

export class EventRegistrationRepository extends BaseRepository {
  constructor(model = eventRegistrationModel) {
    super(model);
  }
}
