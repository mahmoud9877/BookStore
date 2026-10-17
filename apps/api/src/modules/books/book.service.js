import { BadRequestError, NotFoundError } from "../../core/http-errors.js";

const IMAGE_FOLDER = "book";
const IMAGE_REQUIRED = "Image file is required";

const pickBookFields = ({ bookTitle, author, description, price, category, quantity }) => ({
  bookTitle,
  author,
  description,
  price,
  category,
  quantity,
});

export class BookService {
  #books;
  #categories;
  #imageStorage;

  constructor({ bookRepository, categoryRepository, imageStorage }) {
    this.#books = bookRepository;
    this.#categories = categoryRepository;
    this.#imageStorage = imageStorage;
  }

  /** Lists books newest first; paginates only when `limit` is a positive number. */
  listBooks({ page, limit } = {}) {
    const pageSize = Number(limit);
    if (!(pageSize > 0)) return this.#books.list();
    const pageNumber = Math.max(Number(page) || 1, 1);
    return this.#books.list({ skip: (pageNumber - 1) * pageSize, limit: pageSize });
  }

  async getBook(bookId) {
    const book = await this.#books.findById(bookId);
    if (!book) throw new NotFoundError("Book not found");
    return book;
  }

  /** `imagePath` is the uploaded cover's local temp file (required). */
  async createBook(fields, imagePath) {
    if (!imagePath) {
      throw new BadRequestError(IMAGE_REQUIRED, { error: IMAGE_REQUIRED });
    }
    const data = pickBookFields(fields);
    await this.#assertCategoryExists(data.category);
    const { secure_url } = await this.#imageStorage.upload(imagePath, IMAGE_FOLDER);
    return this.#books.create({ ...data, image: secure_url });
  }

  /** `imagePath` is optional; without it the current cover is kept. */
  async updateBook(bookId, fields, imagePath) {
    const update = pickBookFields(fields);
    await this.#assertCategoryExists(update.category);
    if (imagePath) {
      update.image = (await this.#imageStorage.upload(imagePath, IMAGE_FOLDER)).secure_url;
    }
    const book = await this.#books.updateById(bookId, update);
    if (!book) throw new NotFoundError("Book not found");
    return book;
  }

  async deleteBook(bookId) {
    if (!(await this.#books.deleteById(bookId))) {
      throw new NotFoundError("Book not found");
    }
  }

  async likeBook(bookId, userId) {
    const book = await this.#books.addLike(bookId, userId);
    if (!book) throw new BadRequestError("Book not found or already liked");
    return book;
  }

  async unlikeBook(bookId, userId) {
    const book = await this.#books.removeLike(bookId, userId);
    if (!book) throw new BadRequestError("Book not found or not liked yet");
    return book;
  }

  async #assertCategoryExists(name) {
    if (!(await this.#categories.findByName(name))) {
      throw new NotFoundError("Category not found");
    }
  }
}
