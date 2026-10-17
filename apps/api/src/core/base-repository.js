/**
 * Generic data access for one Mongoose model. Subclasses add the queries and
 * atomic updates specific to their entity.
 *
 * Every method resolves plain objects (lean reads, `toObject()` after create),
 * never Mongoose documents, so code outside repositories cannot save, mutate or
 * otherwise reach the database.
 */
export class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  findById(id) {
    return this.model.findById(id).lean();
  }

  findOne(filter) {
    return this.model.findOne(filter).lean();
  }

  async create(data) {
    return (await this.model.create(data)).toObject();
  }

  updateById(id, update) {
    return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
  }

  deleteById(id) {
    return this.model.findByIdAndDelete(id).lean();
  }
}
