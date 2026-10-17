import cartModel from "./cart.model.js";
import { BaseRepository } from "../../core/base-repository.js";

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

  /** Empties the user's cart; resolves null if the user has none. */
  clearByUserId(userId) {
    return this.model.findOneAndUpdate({ userId }, { $set: { books: [] } }, { new: true });
  }
}
