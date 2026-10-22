import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";
import { paginationKeys } from "../../core/pagination.js";
import { LOAN_STATUSES, RESERVATION_STATUSES } from "./circulation-statuses.js";

const barcode = joi.string().trim().uppercase().max(40).required();

export class IdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}

export class CheckoutDto extends RequestDto {
  static schema = joi.object({
    barcode,
    // A member id or a member number (as printed on the card).
    member: joi.string().trim().max(40).required(),
    overrideReason: joi.string().trim().min(5).max(500),
  });
}

export class ReturnDto extends RequestDto {
  static schema = joi.object({
    barcode,
    branch: fields.ref(), // the desk's branch; defaults to the copy's branch
    damaged: joi.boolean().default(false),
    notes: joi.string().trim().max(500).allow(""),
  });
}

export class DeclareLostDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), reason: joi.string().trim().max(500).allow("") });
}

export class ListLoansDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["checkedOutAt", "dueAt", "returnedAt"], "-checkedOutAt"),
    status: joi.string().valid(...Object.values(LOAN_STATUSES)),
    member: fields.ref(),
    book: fields.ref(),
    branch: fields.ref(),
    overdue: joi.boolean(),
    from: joi.date(),
    to: joi.date(),
  });
}

export class OwnLoansDto extends RequestDto {
  static schema = joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    status: joi.string().valid(...Object.values(LOAN_STATUSES)),
  });
}

export class PlaceReservationDto extends RequestDto {
  static schema = joi.object({ book: fields.objectId(), pickupBranch: fields.objectId() });
}

export class StaffReservationDto extends RequestDto {
  static schema = joi.object({ member: fields.objectId(), book: fields.objectId(), pickupBranch: fields.objectId() });
}

export class CancelReservationDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), reason: joi.string().trim().max(300).allow("") });
}

export class ListReservationsDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["createdAt", "expiresAt"], "createdAt"),
    status: joi.string().valid(...Object.values(RESERVATION_STATUSES)),
    book: fields.ref(),
    member: fields.ref(),
    pickupBranch: fields.ref(),
  });
}

export class LoanResponseDto extends ResponseDto {
  static fields = [
    "_id", "copy", "book", "member", "branch", "status", "checkedOutAt", "dueAt", "renewals", "returnedAt",
    "returnBranch", "overrideReason", "returnNotes", "accruedFine", "renewalsLeft",
  ];
}

export class ReservationResponseDto extends ResponseDto {
  static fields = [
    "_id", "book", "member", "pickupBranch", "status", "copy", "readyAt", "expiresAt", "closedAt",
    "cancelReason", "queuePosition", "createdAt",
  ];
}
