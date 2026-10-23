import bookModel from "../models/book.model.js";
import { BaseRepository } from "../../../core/base-repository.js";

// Books are always returned with their category, authors and publisher names.
export const BOOK_POPULATE = [
  { path: "category", select: "name" },
  { path: "authors", select: "name" },
  { path: "publisher", select: "name" },
];
const WITH_CATEGORY = BOOK_POPULATE;

export class BookRepository extends BaseRepository {
  constructor(model = bookModel) {
    super(model);
  }

  /** Newest first; `limit` and `category` (an id) are optional. */
  list({ skip = 0, limit, category } = {}) {
    const filter = category ? { category } : {};
    return this.findMany(filter, { sort: { createdAt: -1 }, skip, limit, populate: WITH_CATEGORY });
  }

  findWithCategory(id) {
    return this.findById(id, { populate: WITH_CATEGORY });
  }

  /** Other editions of the same title (same work key), newest first. */
  findEditions(workKey, exceptId) {
    return this.findMany(
      { workKey, _id: { $ne: exceptId } },
      { sort: { publicationYear: -1, createdAt: -1 }, populate: WITH_CATEGORY, limit: 50 }
    );
  }

  /** What the shop needs to price these books now (see book-pricing.js). */
  findPricing(ids) {
    if (!ids.length) return Promise.resolve([]);
    return this.findMany({ _id: { $in: ids } }, { select: "price discountPercent discountEndsAt" });
  }

  findByIsbn(isbn) {
    return this.findOne({ isbn });
  }

  updateDetails(id, update) {
    return this.updateWhere({ _id: id }, update, { validate: true, populate: WITH_CATEGORY });
  }

  countInCategory(categoryId) {
    return this.countWhere({ category: categoryId });
  }

  /** Resolves `{ [categoryId]: numberOfBooks }`. */
  async countByCategory() {
    const groups = await this.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
    return Object.fromEntries(groups.map(({ _id, count }) => [String(_id), count]));
  }

  /** Books saved before categories were references still hold the category's name. */
  findWithLegacyCategory() {
    return this.findMany({ category: { $type: "string" } }, { select: "category" });
  }

  /** @param {{ bookId: unknown, categoryId: unknown }[]} links */
  async setCategories(links) {
    if (!links.length) return;
    await this.bulkWrite(
      links.map(({ bookId, categoryId }) => ({
        updateOne: { filter: { _id: bookId }, update: { $set: { category: categoryId } } },
      }))
    );
  }

  /**
   * Takes `quantity` copies of every item out of stock, all or nothing. Each
   * decrement is atomic (conditional `$inc`); if a book lacks stock, the copies
   * already taken are put back.
   *
   * @param {{ bookId: unknown, quantity: number }[]} items
   * @returns {Promise<{ reserved: { book: object, quantity: number }[] } | { unavailable: object }>}
   *   `reserved` holds each book as it was before the decrement; `unavailable` is
   *   the first item that could not be reserved.
   */
  async reserveStock(items) {
    const reserved = [];
    for (const item of items) {
      const book = await this.updateWhere(
        { _id: item.bookId, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity } },
        { returnOriginal: true }
      );
      if (!book) {
        await this.releaseStock(reserved.map(({ book: taken, quantity }) => ({ bookId: taken._id, quantity })));
        return { unavailable: item };
      }
      reserved.push({ book, quantity: item.quantity });
    }
    return { reserved };
  }

  /** Puts copies back into stock in one round trip. */
  async releaseStock(items) {
    if (!items.length) return;
    await this.bulkWrite(
      items.map(({ bookId, quantity }) => ({
        updateOne: { filter: { _id: bookId }, update: { $inc: { quantity } } },
      }))
    );
  }

  /** Resolves null when the book does not exist or the user already liked it. */
  addLike(id, userId) {
    return this.updateWhere(
      { _id: id, likes: { $ne: userId } },
      { $push: { likes: userId }, $inc: { totalLikes: 1 } },
      { populate: WITH_CATEGORY }
    );
  }

  /** Resolves null when the book does not exist or the user has not liked it. */
  removeLike(id, userId) {
    return this.updateWhere(
      { _id: id, likes: userId },
      { $pull: { likes: userId }, $inc: { totalLikes: -1 } },
      { populate: WITH_CATEGORY }
    );
  }
}
