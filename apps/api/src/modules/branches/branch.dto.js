import joi from "joi";
import { ResponseDto, crudDtos, fields } from "../../core/dto.js";
import { LOCATION_TYPES } from "./branch.model.js";

export const BranchDtos = crudDtos({
  attributes: {
    code: joi.string().trim().uppercase().max(12).pattern(/^[A-Z0-9-]+$/),
    name: joi.string().trim().max(120),
    address: joi.string().trim().max(300).allow(""),
    phone: fields.mobile().allow(""),
    email: joi.string().email({ tlds: { allow: false } }).allow(""),
    isActive: joi.boolean(),
  },
  required: ["code", "name"],
  filters: { isActive: joi.boolean() },
});

export const LocationDtos = crudDtos({
  attributes: {
    branch: fields.ref(),
    type: joi.string().valid(...Object.values(LOCATION_TYPES)),
    parent: fields.ref().allow(null),
    code: joi.string().trim().uppercase().max(20),
    name: joi.string().trim().max(120).allow(""),
  },
  required: ["branch", "type", "code"],
  filters: { branch: fields.ref(), type: joi.string().valid(...Object.values(LOCATION_TYPES)) },
  sortable: ["code", "createdAt"],
  defaultSort: "code",
});

export class BranchResponseDto extends ResponseDto {
  static fields = ["_id", "code", "name", "address", "phone", "email", "isActive", "createdAt", "updatedAt"];
}

export class LocationResponseDto extends ResponseDto {
  static fields = ["_id", "branch", "type", "parent", "code", "name"];
}
