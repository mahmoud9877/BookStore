import { BookResponseDto } from "./book.dto.js";
import { BadRequestError, NotFoundError } from "../../core/http-errors.js";

const IMAGE_FOLDER = "book";
const IMAGE_REQUIRED = "Image file is required";

export class BookService {
  #books;
  #categories;
  #imageStorage;

  constructor({ bookRepository, categoryRepository, imageStorage }) {
    this.#books = bookRepository;
    this.#categories = categoryRepository;
    this.#imageStorage = imageStorage;
  }

  /** @param {import("./book.dto.js").ListBooksQueryDto} query */
  async listBooks(query) {
    const books = query.isPaginated
      ? await this.#books.list({ skip: query.skip, limit: query.limit })
      : await this.#books.list();
    return BookResponseDto.fromList(books);
  }

  async getBook(bookId) {
    const book = await this.#books.findById(bookId);
    if (!book) throw new NotFoundError("Book not found");
    return BookResponseDto.from(book);
  }

  /**
   * @param {import("./book.dto.js").CreateBookDto} dto
   * @param {string | undefined} imagePath the uploaded cover's local temp file (required)
   */
  async createBook(dto, imagePath) {
    if (!imagePath) {
      throw new BadRequestError(IMAGE_REQUIRED, { error: IMAGE_REQUIRED });
    }
    await this.#assertCategoryExists(dto.category);
    const { secure_url } = await this.#imageStorage.upload(imagePath, IMAGE_FOLDER);
    return BookResponseDto.from(await this.#books.create({ ...dto.toAttributes(), image: secure_url }));
  }

  /**
   * @param {import("./book.dto.js").UpdateBookDto} dto
   * @param {string | undefined} imagePath optional new cover; without it the current one is kept
   */
  async updateBook(dto, imagePath) {
    await this.#assertCategoryExists(dto.category);
    const update = dto.toAttributes();
    if (imagePath) {
      update.image = (await this.#imageStorage.upload(imagePath, IMAGE_FOLDER)).secure_url;
    }
    const book = await this.#books.updateById(dto.id, update);
    if (!book) throw new NotFoundError("Book not found");
    return BookResponseDto.from(book);
  }

  async deleteBook(bookId) {
    if (!(await this.#books.deleteById(bookId))) {
      throw new NotFoundError("Book not found");
    }
  }

  async likeBook(bookId, userId) {
    const book = await this.#books.addLike(bookId, userId);
    if (!book) throw new BadRequestError("Book not found or already liked");
    return BookResponseDto.from(book);
  }

  async unlikeBook(bookId, userId) {
    const book = await this.#books.removeLike(bookId, userId);
    if (!book) throw new BadRequestError("Book not found or not liked yet");
    return BookResponseDto.from(book);
  }

  async #assertCategoryExists(name) {
    if (!(await this.#categories.findByName(name))) {
      throw new NotFoundError("Category not found");
    }
  }
}
