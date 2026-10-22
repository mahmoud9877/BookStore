import joi from "joi";
import { isValidIsbn, normalizeIsbn } from "./isbn.js";
import { RequestDto, ResponseDto, fields, objectIdParamDto } from "../../core/dto.js";

// ---------- Requests

/** Accepts an array or a comma-separated string (multipart forms send strings). */
const stringList = (max) =>
  joi
    .alternatives()
    .try(joi.array().items(joi.string().trim().max(max)), joi.string().allow(""))
    .custom((value) =>
      (Array.isArray(value) ? value : value.split(",")).map((item) => item.trim()).filter(Boolean)
    );

const isbn = joi
  .string()
  .trim()
  .allow("")
  .custom((value, helper) => {
    if (!value) return undefined;
    return isValidIsbn(value) ? normalizeIsbn(value) : helper.message("Invalid ISBN (check digit does not match)");
  });

const bookAttributes = {
  bookTitle: joi.string().trim().required(),
  // Comma-separated author names; each becomes (or matches) an Author record.
  author: joi.string().trim().required(),
  description: joi.string().required(),
  category: fields.objectId(),
  isForSale: joi.boolean().default(true),
  price: joi.number().min(0).default(0),
  quantity: joi.number().integer().min(0).default(0),
  isbn,
  edition: joi.string().trim().max(60).allow(""),
  publisher: fields.ref().allow("", null),
  publicationYear: joi.number().integer().min(1000).max(new Date().getFullYear() + 1).allow(""),
  language: joi.string().trim().max(40).allow(""),
  pageCount: joi.number().integer().min(1).allow(""),
  subjects: stringList(80),
  keywords: stringList(80),
};
const BOOK_ATTRIBUTE_NAMES = Object.keys(bookAttributes);

/** Book attributes sent by the dashboard form (multipart; the cover arrives as req.file). */
export class CreateBookDto extends RequestDto {
  static schema = joi.object(bookAttributes).unknown(true);

  /** Plain attribute object for persistence (empty optional values become null/absent). */
  toAttributes() {
    const attributes = Object.fromEntries(BOOK_ATTRIBUTE_NAMES.map((name) => [name, this[name]]));
    for (const name of ["publisher", "publicationYear", "pageCount", "isbn"]) {
      if (attributes[name] === "" || attributes[name] === undefined) attributes[name] = null;
    }
    return attributes;
  }

  /** The individual author names. */
  get authorNames() {
    return this.author.split(",").map((name) => name.trim()).filter(Boolean);
  }
}

export class UpdateBookDto extends CreateBookDto {
  static schema = joi.object({ ...bookAttributes, id: fields.objectId() }).unknown(true);
}

/** `?page=&limit=`: invalid or missing values mean "no pagination" (never an error). */
export class ListBooksQueryDto extends RequestDto {
  static schema = joi.object({}).unknown(true);

  constructor({ page, limit }) {
    super();
    const toPositiveInteger = (value) => {
      const number = Number(value);
      return Number.isInteger(number) && number > 0 ? number : undefined;
    };
    this.limit = toPositiveInteger(limit);
    this.page = toPositiveInteger(page) ?? 1;
  }

  get isPaginated() {
    return this.limit !== undefined;
  }

  get skip() {
    return (this.page - 1) * (this.limit ?? 0);
  }
}

/** Routes addressing a book as /:bookId. */
export class BookIdDto extends objectIdParamDto("bookId") {}

/** DELETE /book/delete/:id. */
export class DeleteBookDto extends objectIdParamDto("id") {}

// ---------- Responses

/** Public view of a book. Omits the `likes` user-id list and Mongoose internals. */
export class BookResponseDto extends ResponseDto {
  static fields = [
    "_id",
    "bookTitle",
    "author",
    "authors",
    "description",
    "image",
    "isbn",
    "edition",
    "publisher",
    "publicationYear",
    "language",
    "pageCount",
    "subjects",
    "keywords",
    "isForSale",
    "price",
    "quantity",
    "category",
    "totalLikes",
    "availability",
    "createdAt",
    "updatedAt",
  ];
}
