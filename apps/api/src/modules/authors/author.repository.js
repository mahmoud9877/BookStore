import { authorModel, normalizeName } from "./author.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class AuthorRepository extends BaseRepository {
  constructor(model = authorModel) {
    super(model);
  }

  /** Finds each name's author, creating the missing ones; resolves them in order. */
  async findOrCreateByNames(names) {
    const authors = [];
    for (const name of names) {
      const normalizedName = normalizeName(name);
      authors.push(
        await this.updateWhere(
          { normalizedName },
          { $setOnInsert: { name: name.trim().replace(/\s+/g, " "), normalizedName } },
          { upsert: true }
        )
      );
    }
    return authors;
  }
}
