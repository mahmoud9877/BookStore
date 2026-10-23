import joi from "joi";
import { RequestDto, ResponseDto, fields, objectIdParamDto } from "../../../core/dto.js";

// ---------- Requests

const name = joi.string().trim().required();

export class CategoryIdDto extends objectIdParamDto("id") {}

export class CreateCategoryDto extends RequestDto {
  static schema = joi.object({ name });
}

export class UpdateCategoryDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), name });
}

// ---------- Responses

export class CategoryResponseDto extends ResponseDto {
  static fields = ["_id", "name", "bookCount", "createdAt", "updatedAt"];
}
