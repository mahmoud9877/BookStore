import { currentSession } from "./transaction-context.js";

/**
 * Generic data access for one Mongoose model. Subclasses express their queries
 * through the primitives below and never touch the model directly.
 *
 * Every method resolves plain objects (lean reads, `toObject()` after create),
 * never Mongoose documents, so code outside repositories cannot save, mutate or
 * otherwise reach the database.
 *
 * Inside `TransactionRunner.run()`, every primitive joins the active transaction.
 */
export class BaseRepository {
  #model;

  constructor(model) {
    this.#model = model;
  }

  /** `options`: a `select` projection and a `populate` spec (both optional). */
  findById(id, { select, populate } = {}) {
    return this.#finish(this.#model.findById(id), { select, populate });
  }

  findOne(filter, { select, populate, sort } = {}) {
    let query = this.#model.findOne(filter);
    if (sort) query = query.sort(sort);
    return this.#finish(query, { select, populate });
  }

  /** `options`: `sort`, `skip`, `limit` (all optional), a `select` projection and a `populate` spec. */
  findMany(filter = {}, { sort, skip, limit, select, populate } = {}) {
    let query = this.#model.find(filter);
    if (sort) query = query.sort(sort);
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    return this.#finish(query, { select, populate });
  }

  /**
   * One page of `filter` plus the total number of matches.
   * Resolves `{ items, total }`.
   */
  async paginate(filter, { page = 1, limit = 20, sort = { _id: -1 }, select, populate } = {}) {
    const [items, total] = await Promise.all([
      this.findMany(filter, { sort, skip: (page - 1) * limit, limit, select, populate }),
      this.countWhere(filter),
    ]);
    return { items, total };
  }

  async create(data) {
    const session = currentSession();
    if (!session) return (await this.#model.create(data)).toObject();
    const [document] = await this.#model.create([data], { session });
    return document.toObject();
  }

  async insertMany(documents) {
    const session = currentSession();
    const inserted = await this.#model.insertMany(documents, session ? { session } : {});
    return inserted.map((document) => document.toObject());
  }

  updateById(id, update) {
    return this.#withSession(
      this.#model.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    ).lean();
  }

  deleteById(id) {
    return this.#withSession(this.#model.findByIdAndDelete(id)).lean();
  }

  /**
   * Atomically updates the first document matching `filter`; resolves null when
   * nothing matches. Resolves the updated document unless `returnOriginal` is set.
   */
  updateWhere(filter, update, { returnOriginal = false, validate = false, select, populate, upsert = false } = {}) {
    const query = this.#model.findOneAndUpdate(filter, update, {
      new: !returnOriginal,
      runValidators: validate,
      upsert,
    });
    return this.#finish(query, { select, populate });
  }

  /** Resolves the number of documents modified. */
  async updateMany(filter, update) {
    const result = await this.#withSession(this.#model.updateMany(filter, update));
    return result.modifiedCount ?? 0;
  }

  bulkWrite(operations) {
    const session = currentSession();
    return this.#model.bulkWrite(operations, session ? { session } : {});
  }

  countWhere(filter = {}) {
    return this.#withSession(this.#model.countDocuments(filter));
  }

  aggregate(pipeline) {
    const query = this.#model.aggregate(pipeline);
    const session = currentSession();
    return session ? query.session(session) : query;
  }

  /** Streams lean documents (for exports), so large results never sit in memory. */
  cursor(filter = {}, { sort, select, populate } = {}) {
    let query = this.#model.find(filter);
    if (sort) query = query.sort(sort);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    return query.lean().cursor();
  }

  #finish(query, { select, populate }) {
    let result = this.#withSession(query);
    if (select) result = result.select(select);
    if (populate) result = result.populate(populate);
    return result.lean();
  }

  #withSession(query) {
    const session = currentSession();
    return session ? query.session(session) : query;
  }
}
