import joi from "joi";
import { PURCHASE_STATUSES } from "./acquisition.model.js";
import { paginationKeys } from "../../core/pagination.js";
import { RequestDto, ResponseDto, crudDtos, fields } from "../../core/dto.js";

export const SupplierDtos = crudDtos({
  attributes: {
    name: joi.string().trim().max(150),
    contactName: joi.string().trim().max(150).allow(""),
    email: joi.string().email({ tlds: { allow: false } }).allow(""),
    phone: joi.string().trim().max(40).allow(""),
    address: joi.string().trim().max(300).allow(""),
    notes: joi.string().trim().max(1000).allow(""),
    isActive: joi.boolean(),
  },
  required: ["name"],
  filters: { isActive: joi.boolean() },
});

export class SupplierResponseDto extends ResponseDto {
  static fields = ["_id", "name", "contactName", "email", "phone", "address", "notes", "isActive", "createdAt"];
}

const line = joi
  .object({
    book: fields.ref(),
    title: joi.string().trim().max(300),
    isbn: joi.string().trim().max(20).allow(""),
    quantity: joi.number().integer().min(1).max(10_000).required(),
    unitCost: joi.number().integer().min(0).default(0),
  })
  .or("book", "title");

export class IdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}

export class ListPurchaseOrdersDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["createdAt", "orderedAt"]),
    status: joi.string().valid(...Object.values(PURCHASE_STATUSES)),
    supplier: fields.ref(),
    branch: fields.ref(),
  });
}

export class CreatePurchaseRequestDto extends RequestDto {
  static schema = joi.object({
    branch: fields.objectId(),
    supplier: fields.ref(),
    lines: joi.array().items(line).min(1).max(200).required(),
    notes: joi.string().trim().max(1000).allow(""),
  });
}

export class UpdatePurchaseOrderDto extends RequestDto {
  static schema = joi
    .object({
      id: fields.objectId(),
      supplier: fields.ref(),
      lines: joi.array().items(line).min(1).max(200),
      notes: joi.string().trim().max(1000).allow(""),
    })
    .min(2);
}

export class PurchaseActionDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), note: joi.string().trim().max(500).allow("") });
}

export class ReceiveDeliveryDto extends RequestDto {
  static schema = joi.object({
    id: fields.objectId(),
    reference: joi.string().trim().max(100).allow(""),
    lines: joi
      .array()
      .items(joi.object({ line: fields.objectId(), quantity: joi.number().integer().min(1).max(10_000).required() }))
      .min(1)
      .required(),
  });
}

export class PurchaseOrderResponseDto extends ResponseDto {
  static fields = [
    "_id", "number", "status", "branch", "supplier", "currency", "lines", "deliveries", "documents", "notes",
    "requestedBy", "approvedBy", "orderedAt", "closedAt", "totalCost", "receivedCost", "createdAt", "updatedAt",
  ];

  constructor(source) {
    const totalCost = source.lines.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const receivedCost = source.lines.reduce((sum, item) => sum + item.received * item.unitCost, 0);
    // Storage keys are internal; documents are downloaded through the API.
    const documents = (source.documents ?? []).map(({ _id, name, mimeType, size, uploadedAt }) => ({ _id, name, mimeType, size, uploadedAt }));
    super({ ...source, totalCost, receivedCost, documents });
  }
}
