import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../../core/dto.js";
import { paginationKeys } from "../../../core/pagination.js";
import { DIGITAL_ACCESS, LICENSE_TYPES } from "../models/digital.model.js";

const attributes = {
  title: joi.string().trim().max(300),
  book: fields.ref().allow(null, ""),
  description: joi.string().trim().max(5000).allow(""),
  authors: joi.string().trim().max(300).allow(""),
  access: joi.string().valid(...Object.values(DIGITAL_ACCESS)),
  membershipTypes: joi.alternatives().try(joi.array().items(fields.ref()), joi.string().allow("")).custom((value) => (Array.isArray(value) ? value : value.split(",").filter(Boolean))),
  allowDownload: joi.boolean(),
  licenseType: joi.string().valid(...LICENSE_TYPES),
  licenseHolder: joi.string().trim().max(200).allow(""),
  licenseExpiresAt: joi.date().allow(null, ""),
  licenseTerms: joi.string().trim().max(2000).allow(""),
  isPublished: joi.boolean(),
};

export class ListPublicationsDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["title", "createdAt"], "title"),
    search: joi.string().trim().max(100).allow(""),
    format: joi.string(),
    includeUnpublished: joi.boolean().default(false),
  });
}

export class CreatePublicationDto extends RequestDto {
  static schema = joi.object({
    ...attributes,
    title: attributes.title.required(),
    licenseType: attributes.licenseType.required(),
  });
}

export class UpdatePublicationDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), ...attributes }).min(2);
}

export class PublicationIdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}

export class PublicationResponseDto extends ResponseDto {
  static fields = ["_id", "title", "book", "description", "authors", "format", "fileSize", "access", "membershipTypes", "allowDownload", "license", "isPublished", "canOpen", "createdAt"];

  constructor(source) {
    super({ ...source, fileSize: source.file?.size });
  }
}
