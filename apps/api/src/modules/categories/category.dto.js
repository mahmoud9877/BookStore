import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";

// ---------- Requests

export class CategoryIdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });

  constructor({ id }) {
    super();
    this.id = id;
  }
}

export class CreateCategoryDto extends RequestDto {
  static schema = joi.object({ name: joi.string().trim().required() });

  constructor({ name }) {
    super();
    this.name = name;
  }
}

export class UpdateCategoryDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), name: joi.string().trim().required() });

  constructor({ id, name }) {
    super();
    this.id = id;
    this.name = name;
  }
}

// ---------- Responses

export class CategoryResponseDto extends ResponseDto {
  constructor(category) {
    super();
    this._id = category._id;
    this.name = category.name;
    this.createdAt = category.createdAt;
    this.updatedAt = category.updatedAt;
  }
}
