import { authSessionModel } from "../models/auth-session.model.js";

export class AuthSessionRepository {
  #model;

  constructor(model = authSessionModel) {
    this.#model = model;
  }

  create(session) {
    return this.#model.create(session);
  }

  findById(id) {
    return this.#model.findById(id).lean();
  }

  rotate(id, currentHash, refreshTokenHash, expiresAt, previousRefreshTokenValidUntil) {
    return this.#model.findOneAndUpdate(
      { _id: id, refreshTokenHash: currentHash, expiresAt: { $gt: new Date() } },
      {
        $set: {
          refreshTokenHash,
          previousRefreshTokenHash: currentHash,
          previousRefreshTokenValidUntil,
          expiresAt,
        },
      },
      { new: true }
    ).lean();
  }

  deleteById(id) {
    return this.#model.findByIdAndDelete(id).lean();
  }
}
