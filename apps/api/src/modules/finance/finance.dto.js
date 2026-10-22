import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";
import { paginationKeys } from "../../core/pagination.js";
import { FINE_STATUSES, FINE_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES } from "./finance-statuses.js";

const amount = joi.number().integer().min(1).max(100_000_000); // minor units

export class IdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}

export class ListFinesDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["createdAt", "amount"]),
    member: fields.ref(),
    status: joi.string().valid(...Object.values(FINE_STATUSES)),
    type: joi.string().valid(...Object.values(FINE_TYPES)),
    from: joi.date(),
    to: joi.date(),
  });
}

export class CreateFineDto extends RequestDto {
  static schema = joi.object({
    member: fields.objectId(),
    amount: amount.required(),
    reason: joi.string().trim().min(3).max(500).required(),
  });
}

export class WaiveFineDto extends RequestDto {
  static schema = joi.object({
    id: fields.objectId(),
    amount, // default: the whole remaining balance
    reason: joi.string().trim().min(3).max(500).required(),
  });
}

export class ListPaymentsDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["createdAt", "amount"]),
    member: fields.ref(),
    status: joi.string().valid(...Object.values(PAYMENT_STATUSES)),
    method: joi.string().valid(...Object.values(PAYMENT_METHODS)),
    from: joi.date(),
    to: joi.date(),
  });
}

export class RecordCashPaymentDto extends RequestDto {
  static schema = joi.object({
    member: fields.objectId(),
    amount: amount.required(),
    fines: joi.array().items(fields.objectId()).unique().max(100),
    // Also accepted as the Idempotency-Key header.
    idempotencyKey: joi.string().trim().min(8).max(100),
  });
}

export class CardCheckoutDto extends RequestDto {
  static schema = joi.object({ fines: joi.array().items(fields.objectId()).unique().max(100) });
}

export class RefundDto extends RequestDto {
  static schema = joi.object({
    id: fields.objectId(),
    amount: amount.required(),
    reason: joi.string().trim().min(3).max(500).required(),
  });
}

export class FineResponseDto extends ResponseDto {
  static fields = ["_id", "member", "loan", "copy", "branch", "type", "currency", "amount", "paid", "waived", "balance", "status", "reason", "createdAt"];

  constructor(source) {
    super({ ...source, balance: source.amount - source.paid - source.waived });
  }
}

/** Never includes provider secrets; `providerPaymentRef` is an opaque id. */
export class PaymentResponseDto extends ResponseDto {
  static fields = [
    "_id", "member", "branch", "method", "status", "currency", "amount", "allocations", "refunds",
    "refundedAmount", "receiptNumber", "provider", "paidAt", "failureReason", "createdAt",
  ];
}
