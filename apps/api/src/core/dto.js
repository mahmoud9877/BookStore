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

const schemaKeysCache = new WeakMap();

/**
 * Base class for request DTOs. A subclass declares a Joi `schema`; the DTO
 * carries exactly the keys that schema declares (minus `validateOnly` ones, which
 * are checked but not passed on). Anything else the client sent is dropped.
 * Subclasses override the constructor only to derive or reshape values.
 */
export class RequestDto {
  static schema = joi.object({});
  static validateOnly = [];

  /**
   * Validates raw input (with Joi type conversion and defaults).
   * Returns `{ dto }` on success or `{ error }` with Joi's details.
   */
  static parse(input) {
    const { error, value } = this.schema.validate(input, { abortEarly: false });
    return error ? { error } : { dto: new this(value) };
  }

  static get carriedKeys() {
    if (!schemaKeysCache.has(this)) {
      const declared = Object.keys(this.schema.describe().keys ?? {});
      schemaKeysCache.set(this, declared.filter((key) => !this.validateOnly.includes(key)));
    }
    return schemaKeysCache.get(this);
  }

  constructor(value = {}) {
    for (const key of new.target.carriedKeys) {
      this[key] = value[key];
    }
  }
}

/** Builds a request DTO class for routes that take a single ObjectId parameter. */
export const objectIdParamDto = (name) =>
  class extends RequestDto {
    static schema = joi.object({ [name]: fields.objectId() });
  };

/**
 * Base class for response DTOs: the whitelist of fields that leave the API.
 * Subclasses list their `fields`; `nested` maps a field to the response DTO
 * used for each element of that (array) field.
 */
export class ResponseDto {
  static fields = [];
  static nested = {};

  /** Maps one document; null/undefined stay null. */
  static from(source) {
    return source == null ? null : new this(source);
  }

  static fromList(sources = []) {
    return sources.map((source) => new this(source));
  }

  constructor(source) {
    const { fields: names, nested } = new.target;
    for (const name of names) {
      this[name] = nested[name] ? nested[name].fromList(source[name]) : source[name];
    }
  }
}
