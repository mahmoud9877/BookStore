import bookModel from "./book.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class BookRepository extends BaseRepository {
  constructor(model = bookModel) {
    super(model);
  }

  /** Newest first; `limit` is optional. */
  list({ skip = 0, limit } = {}) {
    const query = this.model.find({}).sort({ createdAt: -1 }).skip(skip);
    return limit ? query.limit(limit) : query;
  }

  /** Atomically takes `quantity` copies out of stock; resolves null if not enough are left. */
  decrementStock(id, quantity) {
    return this.model.findOneAndUpdate(
      { _id: id, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } }
    );
  }

  incrementStock(id, quantity) {
    return this.model.updateOne({ _id: id }, { $inc: { quantity } });
  }

  /** Resolves null when the book does not exist or the user already liked it. */
  addLike(id, userId) {
    return this.model.findOneAndUpdate(
      { _id: id, likes: { $ne: userId } },
      { $push: { likes: userId }, $inc: { totalLikes: 1 } },
      { new: true }
    );
  }

  /** Resolves null when the book does not exist or the user has not liked it. */
  removeLike(id, userId) {
    return this.model.findOneAndUpdate(
      { _id: id, likes: userId },
      { $pull: { likes: userId }, $inc: { totalLikes: -1 } },
      { new: true }
    );
  }
}
