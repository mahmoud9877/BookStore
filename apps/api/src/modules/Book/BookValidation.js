import Joi from "joi";
import { Types } from "mongoose";
import { generalFields } from "../../middleware/validation.js";

export const abbBook = Joi.object({
  bookTitle: Joi.string().required(), // Ensure bookId is a valid string
  author: Joi.string().min(2).max(20).required(),
  price: Joi.number().required(),
  image: generalFields.file.required(), // Assuming image is passed as a string path or URL
  quantity: Joi.number().min(1).required(), // Quantity should be a positive integer
});

export const likeOrUnlike = {
  params: Joi.object({
    id: generalFields.id,
  }).required(),
};

export const deleteBook = Joi.object({
  bookId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.message("Invalid bookId format");
      }
      return value;
    }), // Ensures bookId is a valid ObjectId
}); // Ensure bookId is provided for removal

export const updateBook = Joi.object({
  bookId: Joi.string(),
  bookTitle: Joi.string(), // Ensure bookId is a valid string
  author: Joi.string().min(2).max(20),
  price: Joi.number(),
  image: Joi.string().optional(), // Assuming image is passed as a string path or URL
  quantity: Joi.number().min(1),
});
