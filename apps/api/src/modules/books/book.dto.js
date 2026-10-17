import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";

// ---------- Requests

const bookAttributes = {
  bookTitle: joi.string().trim().required(),
  author: joi.string().trim().required(),
  description: joi.string().required(),
  price: joi.number().min(0).required(),
  category: joi.string().trim().required(),
  quantity: joi.number().integer().min(1).required(),
};

/** Book attributes sent by the dashboard form (multipart; the cover arrives as req.file). */
export class BookAttributesDto extends RequestDto {
  static schema = joi.object(bookAttributes).unknown(true);

  constructor({ bookTitle, author, description, price, category, quantity }) {
    super();
    this.bookTitle = bookTitle;
    this.author = author;
    this.description = description;
    this.price = price;
    this.category = category;
    this.quantity = quantity;
  }

  /** Plain attribute object for persistence. */
  toAttributes() {
    const { bookTitle, author, description, price, category, quantity } = this;
    return { bookTitle, author, description, price, category, quantity };
  }
}

export class CreateBookDto extends BookAttributesDto {}

export class UpdateBookDto extends BookAttributesDto {
  static schema = joi.object({ ...bookAttributes, id: fields.objectId() }).unknown(true);

  constructor(input) {
    super(input);
    this.id = input.id;
  }
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
export class BookIdDto extends RequestDto {
  static schema = joi.object({ bookId: fields.objectId() });

  constructor({ bookId }) {
    super();
    this.bookId = bookId;
  }
}

/** DELETE /book/delete/:id. */
export class DeleteBookDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });

  constructor({ id }) {
    super();
    this.id = id;
  }
}

// ---------- Responses

/** Public view of a book. Omits the `likes` user-id list and Mongoose internals. */
export class BookResponseDto extends ResponseDto {
  constructor(book) {
    super();
    this._id = book._id;
    this.bookTitle = book.bookTitle;
    this.author = book.author;
    this.description = book.description;
    this.image = book.image;
    this.price = book.price;
    this.quantity = book.quantity;
    this.category = book.category;
    this.totalLikes = book.totalLikes;
    this.createdAt = book.createdAt;
    this.updatedAt = book.updatedAt;
  }
}
