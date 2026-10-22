import joi from "joi";
import { RequestDto } from "../../core/dto.js";
import { librarySettingsSchema } from "./library-settings.js";

export class UpdateSettingsDto extends RequestDto {
  static schema = librarySettingsSchema.keys({ version: joi.number().integer().min(0).required() });
}
