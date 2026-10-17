import joi from "joi";
import { RequestDto, ResponseDto, fields, objectIdParamDto } from "../../core/dto.js";

// ---------- Requests

const bookAttributes = {
  bookTitle: joi.string().trim().required(),
  author: joi.string().trim().required(),
  description: joi.string().required(),
  price: joi.number().min(0).required(),
  category: joi.string().trim().required(),
  quantity: joi.number().integer().min(1).required(),
};
const BOOK_ATTRIBUTE_NAMES = Object.keys(bookAttributes);

/** Book attributes sent by the dashboard form (multipart; the cover arrives as req.file). */
export class CreateBookDto extends RequestDto {
  static schema = joi.object(bookAttributes).unknown(true);

  /** Plain attribute object for persistence. */
  toAttributes() {
    return Object.fromEntries(BOOK_ATTRIBUTE_NAMES.map((name) => [name, this[name]]));
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
    "description",
    "image",
    "price",
    "quantity",
    "category",
    "totalLikes",
    "createdAt",
    "updatedAt",
  ];
}
