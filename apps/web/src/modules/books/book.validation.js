import Joi from "joi";

/** ISBN-10/13 with a correct check digit (mirrors apps/api/src/modules/books/isbn.js). */
export function isValidIsbn(value) {
  const isbn = String(value).replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    return [...isbn].reduce((sum, char, index) => sum + (char === "X" ? 10 : Number(char)) * (10 - index), 0) % 11 === 0;
  }
  if (/^\d{13}$/.test(isbn)) {
    return [...isbn].reduce((sum, char, index) => sum + Number(char) * (index % 2 ? 3 : 1), 0) % 10 === 0;
  }
  return false;
}

const optionalNumber = (rule) => Joi.alternatives().try(Joi.string().valid(""), rule);

// Mirrors the API's CreateBookDto/UpdateBookDto (apps/api/src/modules/books/book.dto.js).
export const bookSchema = Joi.object({
  bookTitle: Joi.string().trim().required().messages({ "string.empty": "Enter the book's title." }),
  author: Joi.string().trim().required().messages({ "string.empty": "Enter the author's name." }),
  category: Joi.string().required().messages({ "string.empty": "Choose a category." }),
  description: Joi.string().trim().required().messages({ "string.empty": "Add a short description." }),
  isbn: Joi.string()
    .trim()
    .allow("")
    .custom((value, helpers) => (!value || isValidIsbn(value) ? value : helpers.message("This ISBN's check digit doesn't match."))),
  edition: Joi.string().trim().allow("").max(60),
  publisher: Joi.string().allow(""),
  publicationYear: optionalNumber(Joi.number().integer().min(1000).max(new Date().getFullYear() + 1)).messages({
    "alternatives.match": "Enter a four-digit year.",
  }),
  language: Joi.string().trim().allow("").max(40),
  pageCount: optionalNumber(Joi.number().integer().min(1)).messages({ "alternatives.match": "Enter a whole number of pages." }),
  subjects: Joi.string().allow(""),
  keywords: Joi.string().allow(""),
  isForSale: Joi.boolean(),
  price: Joi.when("isForSale", {
    is: true,
    then: Joi.number().min(0).required().messages({ "number.base": "Enter a price.", "number.min": "The price can't be negative." }),
    otherwise: Joi.any(),
  }),
  quantity: Joi.when("isForSale", {
    is: true,
    then: Joi.number().integer().min(0).required().messages({
      "number.base": "Enter how many copies are in stock.",
      "number.integer": "Stock must be a whole number.",
      "number.min": "Stock can't be negative.",
    }),
    otherwise: Joi.any(),
  }),
  image: Joi.any(),
});
