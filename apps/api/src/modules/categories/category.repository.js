import { categoryModel } from "./category.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class CategoryRepository extends BaseRepository {
  constructor(model = categoryModel) {
    super(model);
  }

  list() {
    return this.findMany({}, { sort: { name: 1 } });
  }

  findByName(name) {
    return this.findOne({ name });
  }
}
