import { categoryModel } from "./category.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class CategoryRepository extends BaseRepository {
  constructor(model = categoryModel) {
    super(model);
  }

  list() {
    return this.model.find({});
  }

  findByName(name) {
    return this.findOne({ name });
  }
}
