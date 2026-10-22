import { CategoryResponseDto } from "./category.dto.js";
import { BookResponseDto } from "../books/book.dto.js";
import { ConflictError, ensureFound } from "../../core/http-errors.js";

const CATEGORY_NOT_FOUND = "Category not found";

/** Categories and the books that belong to them (one category has many books). */
export class CategoryService {
  #categories;
  #books;

  constructor({ categoryRepository, bookRepository }) {
    this.#categories = categoryRepository;
    this.#books = bookRepository;
  }

  async listCategories() {
    const [categories, counts] = await Promise.all([this.#categories.list(), this.#books.countByCategory()]);
    return CategoryResponseDto.fromList(
      categories.map((category) => ({ ...category, bookCount: counts[String(category._id)] ?? 0 }))
    );
  }

  async getCategory(id) {
    const category = ensureFound(await this.#categories.findById(id), CATEGORY_NOT_FOUND);
    return CategoryResponseDto.from({ ...category, bookCount: await this.#books.countInCategory(id) });
  }

  async listBooksInCategory(id) {
    ensureFound(await this.#categories.findById(id), CATEGORY_NOT_FOUND);
    return BookResponseDto.fromList(await this.#books.list({ category: id }));
  }

  /** @param {import("./category.dto.js").CreateCategoryDto} dto */
  async createCategory({ name }) {
    await this.#assertNameIsFree(name);
    return CategoryResponseDto.from({ ...(await this.#categories.create({ name })), bookCount: 0 });
  }

  /** @param {import("./category.dto.js").UpdateCategoryDto} dto */
  async updateCategory({ id, name }) {
    await this.#assertNameIsFree(name, id);
    const category = ensureFound(await this.#categories.updateById(id, { name }), CATEGORY_NOT_FOUND);
    return CategoryResponseDto.from({ ...category, bookCount: await this.#books.countInCategory(id) });
  }

  /** A category that still has books cannot be deleted (they would be orphaned). */
  async deleteCategory(id) {
    ensureFound(await this.#categories.findById(id), CATEGORY_NOT_FOUND);
    const bookCount = await this.#books.countInCategory(id);
    if (bookCount > 0) {
      throw new ConflictError(`This category has ${bookCount} book(s). Move or delete them first.`);
    }
    await this.#categories.deleteById(id);
  }

  async #assertNameIsFree(name, exceptId) {
    const existing = await this.#categories.findByName(name.toLowerCase());
    if (existing && String(existing._id) !== String(exceptId)) {
      throw new ConflictError("A category with this name already exists");
    }
  }
}
