/**
 * Generic data access for one Mongoose model. Subclasses express their queries
 * through the primitives below and never touch the model directly.
 *
 * Every method resolves plain objects (lean reads, `toObject()` after create),
 * never Mongoose documents, so code outside repositories cannot save, mutate or
 * otherwise reach the database.
 */
export class BaseRepository {
  #model;

  constructor(model) {
    this.#model = model;
  }

  findById(id, { select } = {}) {
    const query = this.#model.findById(id);
    return (select ? query.select(select) : query).lean();
  }

  findOne(filter) {
    return this.#model.findOne(filter).lean();
  }

  /** `options`: `sort`, `skip`, `limit` (all optional) and a `select` projection. */
  findMany(filter = {}, { sort, skip, limit, select } = {}) {
    let query = this.#model.find(filter);
    if (sort) query = query.sort(sort);
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    if (select) query = query.select(select);
    return query.lean();
  }

  async create(data) {
    return (await this.#model.create(data)).toObject();
  }

  updateById(id, update) {
    return this.#model.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
  }

  deleteById(id) {
    return this.#model.findByIdAndDelete(id).lean();
  }

  /**
   * Atomically updates the first document matching `filter`; resolves null when
   * nothing matches. Resolves the updated document unless `returnOriginal` is set.
   */
  updateWhere(filter, update, { returnOriginal = false, validate = false } = {}) {
    return this.#model
      .findOneAndUpdate(filter, update, { new: !returnOriginal, runValidators: validate })
      .lean();
  }

  bulkWrite(operations) {
    return this.#model.bulkWrite(operations);
  }
}
