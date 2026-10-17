import { CATEGORY_OPTIONS } from "./category-options.js";
import { CategoryResponseDto } from "./category.dto.js";
import { BadRequestError, NotFoundError } from "../../core/http-errors.js";

export class CategoryService {
  #categories;

  constructor({ categoryRepository }) {
    this.#categories = categoryRepository;
  }

  async listCategories() {
    return CategoryResponseDto.fromList(await this.#categories.list());
  }

  listCategoryOptions() {
    return CATEGORY_OPTIONS;
  }

  async getCategory(id) {
    const category = await this.#categories.findById(id);
    if (!category) throw new NotFoundError("Category not found");
    return CategoryResponseDto.from(category);
  }

  /** @param {import("./category.dto.js").CreateCategoryDto} dto */
  async createCategory({ name }) {
    return CategoryResponseDto.from(await this.#categories.create({ name }));
  }

  /** @param {import("./category.dto.js").UpdateCategoryDto} dto */
  async updateCategory({ id, name }) {
    if (!CATEGORY_OPTIONS.includes(name)) {
      const message = `Invalid category name. Choose from: ${CATEGORY_OPTIONS.join(", ")}`;
      throw new BadRequestError(message, { error: message });
    }
    const category = await this.#categories.updateById(id, { name });
    if (!category) throw new NotFoundError("Category not found");
    return CategoryResponseDto.from(category);
  }

  async deleteCategory(id) {
    if (!(await this.#categories.deleteById(id))) {
      throw new NotFoundError("Category not found");
    }
  }
}
