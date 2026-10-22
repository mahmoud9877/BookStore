import joi from "joi";
import { Types } from "mongoose";
import { RequestDto, fields } from "../../core/dto.js";
import { ensureFound } from "../../core/http-errors.js";
import { BOOK_POPULATE } from "../books/book.repository.js";
import { BookResponseDto } from "../books/book.dto.js";

export class CatalogSearchDto extends RequestDto {
  static schema = joi.object({
    q: joi.string().trim().max(200).allow(""),
    category: fields.ref(),
    author: fields.ref(),
    publisher: fields.ref(),
    isbn: joi.string().trim().max(20),
    subject: joi.string().trim().max(80),
    language: joi.string().trim().max(40),
    yearFrom: joi.number().integer().min(0).max(3000),
    yearTo: joi.number().integer().min(0).max(3000),
    available: joi.boolean(),
    branch: fields.ref(),
    sort: joi.string().valid("relevance", "title", "newest", "year", "available").default("relevance"),
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(60).default(24),
  });
}

export class RelatedDto extends RequestDto {
  static schema = joi.object({ bookId: fields.objectId(), limit: joi.number().integer().min(1).max(24).default(8) });
}

/**
 * Public catalogue discovery: search with filters and availability, and
 * "related titles" computed only from catalogue data (shared subjects, authors,
 * category) — never from what other members borrowed.
 */
export class CatalogService {
  #search;
  #books;
  #copies;

  constructor({ catalogSearchProvider, bookRepository, copyRepository }) {
    this.#search = catalogSearchProvider;
    this.#books = bookRepository;
    this.#copies = copyRepository;
  }

  /** @param {CatalogSearchDto} query */
  async search(query) {
    const { ids, availability, total } = await this.#search.search(query);
    const books = await this.#books.findMany({ _id: { $in: ids } }, { populate: BOOK_POPULATE });
    const byId = new Map(books.map((book) => [String(book._id), book]));
    const data = ids
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map((book) => BookResponseDto.from({ ...book, availability: availability[String(book._id)] }));
    return { data, meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
  }

  async related({ bookId, limit }) {
    const book = ensureFound(await this.#books.findById(bookId), "Book not found");
    const subjects = book.subjects ?? [];
    const authors = book.authors ?? [];
    const rows = await this.#books.aggregate([
      {
        $match: {
          _id: { $ne: book._id },
          ...(book.workKey && { workKey: { $ne: book.workKey } }), // other editions are listed separately
          $or: [{ subjects: { $in: subjects } }, { authors: { $in: authors } }, { category: book.category }],
        },
      },
      {
        $set: {
          relevance: {
            $add: [
              { $multiply: [3, { $size: { $setIntersection: [{ $ifNull: ["$subjects", []] }, subjects] } }] },
              { $multiply: [2, { $size: { $setIntersection: [{ $ifNull: ["$authors", []] }, authors.map((id) => new Types.ObjectId(String(id)))] } }] },
              { $cond: [{ $eq: ["$category", book.category] }, 1, 0] },
            ],
          },
        },
      },
      { $sort: { relevance: -1, totalLikes: -1, _id: 1 } },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]);
    const ids = rows.map((row) => row._id);
    const [books, availability] = await Promise.all([
      this.#books.findMany({ _id: { $in: ids } }, { populate: BOOK_POPULATE }),
      this.#copies.availabilityFor(ids),
    ]);
    const byId = new Map(books.map((item) => [String(item._id), item]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean).map((item) => BookResponseDto.from({ ...item, availability: availability[item._id] ?? null }));
  }
}
