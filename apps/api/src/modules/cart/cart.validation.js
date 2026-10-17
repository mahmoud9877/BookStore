import Joi from "joi";

export const addToCart = Joi.object({
  bookId: Joi.string().required(), // Ensure bookId is a valid string
  quantity: Joi.number().min(1).required(), // Quantity should be a positive integer
});

export const deleteFromCart = Joi.object({
  bookId: Joi.string().required(), // Ensure bookId is provided for removal
});
