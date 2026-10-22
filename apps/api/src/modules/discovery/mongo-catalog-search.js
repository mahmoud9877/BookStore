import { Types } from "mongoose";
import { COPY_STATUSES } from "../copies/copy-statuses.js";
import { isValidIsbn, normalizeIsbn } from "../books/isbn.js";
import { escapeRegExp } from "../../core/pagination.js";

const oid = (id) => new Types.ObjectId(String(id));

const SORTS = {
  relevance: { score: { $meta: "textScore" }, _id: 1 },
  title: { bookTitle: 1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
  year: { publicationYear: -1, _id: -1 },
  available: { "availability.available": -1, _id: 1 },
};

/**
 * Catalogue search on MongoDB (text index + filters + availability from
 * copies). It implements the search provider port used by CatalogService:
 *   search(query) -> { ids: [bookId], availability: { [bookId]: {...} }, total }
 * A dedicated engine (OpenSearch, Meilisearch, …) can replace it by
 * implementing the same method; nothing else changes.
 */
export class MongoCatalogSearch {
  #books;

  constructor({ bookRepository }) {
    this.#books = bookRepository;
  }

  async search({ q, category, author, publisher, isbn, subject, language, yearFrom, yearTo, available, branch, sort, page, limit }) {
    const match = {};
    let useText = false;
    if (q) {
      if (isValidIsbn(q)) match.isbn = normalizeIsbn(q);
      else {
        match.$text = { $search: q };
        useText = true;
      }
    }
    if (category) match.category = oid(category);
    if (author) match.authors = oid(author);
    if (publisher) match.publisher = oid(publisher);
    if (isbn) match.isbn = normalizeIsbn(isbn);
    if (subject) match.subjects = new RegExp(`^${escapeRegExp(subject.toLowerCase())}`);
    if (language) match.language = language.toLowerCase();
    if (yearFrom || yearTo) match.publicationYear = { ...(yearFrom && { $gte: yearFrom }), ...(yearTo && { $lte: yearTo }) };

    const copyMatch = { $expr: { $eq: ["$book", "$$book"] }, status: { $ne: COPY_STATUSES.withdrawn }, ...(branch && { branch: oid(branch) }) };
    const sortKey = sort === "relevance" && !useText ? "title" : sort;
    const pipeline = [
      { $match: match },
      ...(useText ? [{ $set: { score: { $meta: "textScore" } } }] : []),
      {
        $lookup: {
          from: "copies",
          let: { book: "$_id" },
          pipeline: [
            { $match: copyMatch },
            { $group: { _id: null, total: { $sum: 1 }, available: { $sum: { $cond: [{ $eq: ["$status", COPY_STATUSES.available] }, 1, 0] } } } },
          ],
          as: "copyCounts",
        },
      },
      { $set: { availability: { total: { $ifNull: [{ $first: "$copyCounts.total" }, 0] }, available: { $ifNull: [{ $first: "$copyCounts.available" }, 0] } } } },
      ...(available === true ? [{ $match: { "availability.available": { $gt: 0 } } }] : []),
      ...(available === false ? [{ $match: { "availability.available": 0 } }] : []),
      { $sort: useText && sortKey === "relevance" ? { score: -1, _id: 1 } : SORTS[sortKey] ?? SORTS.title },
      { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { _id: 1, availability: 1 } }], total: [{ $count: "n" }] } },
    ];
    const [result] = await this.#books.aggregate(pipeline);
    return {
      ids: result.items.map((item) => item._id),
      availability: Object.fromEntries(result.items.map((item) => [String(item._id), item.availability])),
      total: result.total[0]?.n ?? 0,
    };
  }
}
