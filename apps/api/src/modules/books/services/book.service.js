import { workKeyOf } from "../models/book.model.js";
import { BookResponseDto } from "../dtos/book.dto.js";
import { BadRequestError, ConflictError, ensureFound } from "../../../core/http-errors.js";

const IMAGE_FOLDER = "book";
const BOOK_NOT_FOUND = "Book not found";

/** Bibliographic records (editions): what the catalogue and the shop show. */
export class BookService {
  #books;
  #categories;
  #authors;
  #publishers;
  #copies;
  #imageStorage;
  #audit;

  constructor({ bookRepository, categoryRepository, authorRepository, publisherRepository, copyRepository, imageStorage, auditService }) {
    this.#books = bookRepository;
    this.#categories = categoryRepository;
    this.#authors = authorRepository;
    this.#publishers = publisherRepository;
    this.#copies = copyRepository;
    this.#imageStorage = imageStorage;
    this.#audit = auditService;
  }

  /** @param {import("../dtos/book.dto.js").ListBooksQueryDto} query */
  async listBooks(query) {
    const books = query.isPaginated
      ? await this.#books.list({ skip: query.skip, limit: query.limit })
      : await this.#books.list();
    return BookResponseDto.fromList(books);
  }

  /** A book with its lending availability (copies per branch). */
  async getBook(bookId) {
    const book = ensureFound(await this.#books.findWithCategory(bookId), BOOK_NOT_FOUND);
    const availability = (await this.#copies.availabilityFor([bookId]))[bookId] ?? null;
    return BookResponseDto.from({ ...book, availability });
  }

  /** The other editions of the same title. */
  async listEditions(bookId) {
    const book = ensureFound(await this.#books.findById(bookId), BOOK_NOT_FOUND);
    const editions = book.workKey ? await this.#books.findEditions(book.workKey, book._id) : [];
    return BookResponseDto.fromList(editions);
  }

  /**
   * @param {import("../dtos/book.dto.js").CreateBookDto} dto
   * @param {{ path: string, originalname: string } | undefined} cover optional uploaded cover
   */
  async createBook(dto, cover, actor) {
    const attributes = await this.#prepare(dto);
    if (cover) attributes.image = await this.#uploadCover(cover);
    const { _id } = await this.#books.create(attributes);
    await this.#audit.record(actor, { action: "book.create", entity: "Book", entityId: _id, after: attributes });
    return this.getBook(_id);
  }

  /**
   * @param {import("../dtos/book.dto.js").UpdateBookDto} dto
   * @param {{ path: string, originalname: string } | undefined} cover optional new cover; without it the current one is kept
   */
  async updateBook(dto, cover, actor) {
    const update = await this.#prepare(dto, dto.id);
    if (cover) update.image = await this.#uploadCover(cover);
    const book = ensureFound(await this.#books.updateDetails(dto.id, update), BOOK_NOT_FOUND);
    await this.#audit.record(actor, { action: "book.update", entity: "Book", entityId: dto.id, after: update });
    return BookResponseDto.from(book);
  }

  /** A book with physical copies cannot be deleted: withdraw the copies instead. */
  async deleteBook(bookId, actor) {
    if (await this.#copies.countWhere({ book: bookId })) {
      throw new ConflictError("This book has physical copies. Withdraw them instead of deleting the record.");
    }
    const book = ensureFound(await this.#books.deleteById(bookId), BOOK_NOT_FOUND);
    await this.#audit.record(actor, { action: "book.delete", entity: "Book", entityId: bookId, before: book });
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

  /** Validates references and derives the stored attributes (authors, work key). */
  async #prepare(dto, existingId) {
    const attributes = dto.toAttributes();
    ensureFound(await this.#categories.findById(attributes.category), "Category not found");
    if (attributes.publisher) ensureFound(await this.#publishers.findById(attributes.publisher), "Publisher not found");
    if (attributes.isbn) {
      const sameIsbn = await this.#books.findByIsbn(attributes.isbn);
      if (sameIsbn && String(sameIsbn._id) !== String(existingId)) {
        throw new ConflictError("Another book already has this ISBN");
      }
    }
    const authors = await this.#authors.findOrCreateByNames(dto.authorNames);
    attributes.authors = authors.map((author) => author._id);
    attributes.author = authors.map((author) => author.name).join(", ");
    attributes.workKey = workKeyOf(attributes.bookTitle, attributes.author);
    return attributes;
  }

  async #uploadCover(cover) {
    return (await this.#imageStorage.upload(cover.path, IMAGE_FOLDER, cover.originalname)).secure_url;
  }
}
