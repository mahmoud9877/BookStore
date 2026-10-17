import { CATEGORY_OPTIONS } from "./category.model.js";
import { BadRequestError, NotFoundError } from "../../core/http-errors.js";

export class CategoryService {
  #categories;

  constructor({ categoryRepository }) {
    this.#categories = categoryRepository;
  }

  listCategories() {
    return this.#categories.list();
  }

  listCategoryOptions() {
    return CATEGORY_OPTIONS;
  }

  async getCategory(id) {
    const category = await this.#categories.findById(id);
    if (!category) throw new NotFoundError("Category not found");
    return category;
  }

  createCategory(name) {
    return this.#categories.create({ name });
  }

  async updateCategory(id, name) {
    if (!CATEGORY_OPTIONS.includes(name)) {
      const message = `Invalid category name. Choose from: ${CATEGORY_OPTIONS.join(", ")}`;
      throw new BadRequestError(message, { error: message });
    }
    const category = await this.#categories.updateById(id, { name });
    if (!category) throw new NotFoundError("Category not found");
    return category;
  }

  async deleteCategory(id) {
    if (!(await this.#categories.deleteById(id))) {
      throw new NotFoundError("Category not found");
    }
  }
}
