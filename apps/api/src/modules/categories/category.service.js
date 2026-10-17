import { CATEGORY_OPTIONS } from "./category-options.js";
import { CategoryResponseDto } from "./category.dto.js";
import { BadRequestError, ensureFound } from "../../core/http-errors.js";

const CATEGORY_NOT_FOUND = "Category not found";

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
    return CategoryResponseDto.from(ensureFound(await this.#categories.findById(id), CATEGORY_NOT_FOUND));
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
    return CategoryResponseDto.from(ensureFound(category, CATEGORY_NOT_FOUND));
  }

  async deleteCategory(id) {
    ensureFound(await this.#categories.deleteById(id), CATEGORY_NOT_FOUND);
  }
}
