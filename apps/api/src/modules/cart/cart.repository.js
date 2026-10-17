import cartModel from "./cart.model.js";
import { BaseRepository } from "../../core/base-repository.js";

/** Every update is a single atomic operation that resolves the updated cart. */
export class CartRepository extends BaseRepository {
  constructor(model = cartModel) {
    super(model);
  }

  findByUserId(userId) {
    return this.findOne({ userId });
  }

  createForUser(userId, items) {
    return this.create({ userId, books: items });
  }

  /** Appends a line item; resolves null if the user has no cart. */
  addItem(userId, item) {
    return this.updateWhere({ userId }, { $push: { books: item } }, { validate: true });
  }

  /** Adds to an existing line item's quantity; resolves null if that book is not in the cart. */
  incrementItemQuantity(userId, bookId, quantity) {
    return this.updateWhere(
      { userId, "books.bookId": bookId },
      { $inc: { "books.$.quantity": quantity } }
    );
  }

  /** Removes a line item; resolves null if the cart or the book in it does not exist. */
  removeItem(userId, bookId) {
    return this.updateWhere({ userId, "books.bookId": bookId }, { $pull: { books: { bookId } } });
  }

  /** Empties the user's cart; resolves null if the user has none. */
  clearByUserId(userId) {
    return this.updateWhere({ userId }, { $set: { books: [] } });
  }
}
