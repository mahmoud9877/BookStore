import Joi from "joi";

// Mirrors the API's CreateBookDto/UpdateBookDto (apps/api/src/modules/books/book.dto.js).
export const bookSchema = Joi.object({
  bookTitle: Joi.string().trim().required().messages({ "string.empty": "Enter the book's title." }),
  author: Joi.string().trim().required().messages({ "string.empty": "Enter the author's name." }),
  category: Joi.string().required().messages({ "string.empty": "Choose a category." }),
  description: Joi.string().trim().required().messages({ "string.empty": "Add a short description." }),
  price: Joi.number().min(0).required().messages({
    "number.base": "Enter a price.",
    "number.min": "The price can't be negative.",
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    "number.base": "Enter how many copies are in stock.",
    "number.integer": "Stock must be a whole number.",
    "number.min": "Stock must be at least 1.",
  }),
  image: Joi.any(),
});
