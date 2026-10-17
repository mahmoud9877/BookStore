import bookModel from "./book.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class BookRepository extends BaseRepository {
  constructor(model = bookModel) {
    super(model);
  }

  /** Newest first; `limit` is optional. */
  list({ skip = 0, limit } = {}) {
    return this.findMany({}, { sort: { createdAt: -1 }, skip, limit });
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
      { $push: { likes: userId }, $inc: { totalLikes: 1 } }
    );
  }

  /** Resolves null when the book does not exist or the user has not liked it. */
  removeLike(id, userId) {
    return this.updateWhere(
      { _id: id, likes: userId },
      { $pull: { likes: userId }, $inc: { totalLikes: -1 } }
    );
  }
}
