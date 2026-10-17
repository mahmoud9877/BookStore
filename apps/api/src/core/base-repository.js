/**
 * Generic data access for one Mongoose model. Subclasses add queries specific
 * to their entity; nothing outside a repository should touch a model directly.
 */
export class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  findById(id) {
    return this.model.findById(id);
  }

  findOne(filter) {
    return this.model.findOne(filter);
  }

  create(data) {
    return this.model.create(data);
  }

  updateById(id, update) {
    return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  }

  deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }

  save(document) {
    return document.save();
  }
}
