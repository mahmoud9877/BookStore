import joi from "joi";
import { Types } from "mongoose";

/** Joi fields shared by request DTOs. */
export const fields = {
  objectId: () =>
    joi
      .string()
      .custom((value, helper) =>
        Types.ObjectId.isValid(value) ? value : helper.message("Invalid ObjectId")
      )
      .required(),
};

/**
 * Base class for request DTOs. A subclass declares a Joi `schema` and copies the
 * fields it needs in its constructor; anything else the client sent is dropped.
 */
export class RequestDto {
  static schema = joi.object({});

  /**
   * Validates raw input (with Joi type conversion and defaults).
   * Returns `{ dto }` on success or `{ error }` with Joi's details.
   */
  static parse(input) {
    const { error, value } = this.schema.validate(input, { abortEarly: false });
    return error ? { error } : { dto: new this(value) };
  }
}

/**
 * Base class for response DTOs: the whitelist of fields that leave the API.
 * Subclasses copy what they expose from a source document in their constructor.
 */
export class ResponseDto {
  /** Maps one document; null/undefined stay null. */
  static from(source) {
    return source == null ? null : new this(source);
  }

  static fromList(sources = []) {
    return sources.map((source) => new this(source));
  }
}
