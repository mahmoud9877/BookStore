import joi from "joi";
import { generalFields } from "../../middleware/validate.js";

const bookFields = {
  bookTitle: joi.string().trim().required(),
  author: joi.string().trim().required(),
  description: joi.string().required(),
  price: joi.number().min(0).required(),
  category: joi.string().trim().required(),
  quantity: joi.number().integer().min(1).required(),
};

// Multipart bodies: the image itself arrives as req.file, not as a field.
export const addBook = joi.object(bookFields).unknown(true);

export const updateBook = joi
  .object({ ...bookFields, id: generalFields.id })
  .unknown(true);

export const bookIdParam = joi.object({ bookId: generalFields.id });

export const deleteBook = joi.object({ id: generalFields.id });
