import joi from "joi";
import { generalFields } from "../../middleware/validate.js";

export const addToCart = joi.object({
  bookId: generalFields.id,
  quantity: joi.number().integer().min(1).required(),
});

export const removeCartItem = joi.object({
  bookId: generalFields.id,
});
