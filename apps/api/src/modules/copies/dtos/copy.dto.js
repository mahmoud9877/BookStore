import joi from "joi";
import { COPY_CONDITIONS, COPY_STATUSES } from "../constants/copy-statuses.js";
import { RequestDto, ResponseDto, fields } from "../../../core/dto.js";
import { paginationKeys } from "../../../core/pagination.js";

const barcode = joi.string().trim().uppercase().max(40).pattern(/^[A-Z0-9-]+$/);
const cost = joi.number().integer().min(0).allow(null);

export class ListCopiesDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["barcode", "createdAt", "status"], "barcode"),
    book: fields.ref(),
    branch: fields.ref(),
    status: joi.string().valid(...Object.values(COPY_STATUSES)),
    search: joi.string().trim().max(40).allow(""),
  });
}

export class CopyIdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}

export class BarcodeDto extends RequestDto {
  static schema = joi.object({ barcode: barcode.required() });
}

/** Adds `count` copies of a book to a branch; barcodes are generated unless given. */
export class CreateCopiesDto extends RequestDto {
  static schema = joi.object({
    book: fields.objectId(),
    branch: fields.objectId(),
    location: fields.ref().allow(null),
    count: joi.number().integer().min(1).max(200).default(1),
    barcodes: joi.array().items(barcode).unique(),
    condition: joi.string().valid(...COPY_CONDITIONS).default("new"),
    cost,
    notes: joi.string().trim().max(500).allow(""),
  });
}

export class UpdateCopyDto extends RequestDto {
  static schema = joi
    .object({
      id: fields.objectId(),
      location: fields.ref().allow(null),
      condition: joi.string().valid(...COPY_CONDITIONS),
      cost,
      notes: joi.string().trim().max(500).allow(""),
    })
    .min(2);
}

/** A manual inventory adjustment (see ADJUSTMENT_TRANSITIONS). */
export class AdjustCopyStatusDto extends RequestDto {
  static schema = joi.object({
    id: fields.objectId(),
    status: joi.string().valid(...Object.values(COPY_STATUSES)).required(),
    reason: joi.string().trim().min(3).max(500).required(),
  });
}

export class CopyResponseDto extends ResponseDto {
  static fields = [
    "_id", "book", "barcode", "branch", "location", "status", "condition", "cost",
    "acquiredAt", "supplier", "purchaseOrder", "notes", "reservation", "transfer", "createdAt", "updatedAt",
  ];
}
