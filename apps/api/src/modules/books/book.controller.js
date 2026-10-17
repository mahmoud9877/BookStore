import { asyncHandler } from "../../middleware/error-handler.js";

export class BookController {
  #bookService;

  constructor(bookService) {
    this.#bookService = bookService;
  }

  listBooks = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    return res.status(200).json({ book: await this.#bookService.listBooks({ page, limit }) });
  });

  getBookById = asyncHandler(async (req, res) => {
    const book = await this.#bookService.getBook(req.params.bookId);
    return res.status(200).json({ message: "Done", book });
  });

  addBook = asyncHandler(async (req, res) => {
    const book = await this.#bookService.createBook(req.body, req.file?.path);
    return res.status(201).json({ message: "Book added successfully", book });
  });

  updateBook = asyncHandler(async (req, res) => {
    const book = await this.#bookService.updateBook(req.params.id, req.body, req.file?.path);
    return res.status(200).json({ message: "Book updated successfully", book });
  });

  deleteBook = asyncHandler(async (req, res) => {
    await this.#bookService.deleteBook(req.params.id);
    return res.status(200).json({ message: "Book deleted successfully" });
  });

  likeBook = asyncHandler(async (req, res) => {
    const book = await this.#bookService.likeBook(req.params.bookId, req.user._id);
    return res.json({ message: "Book liked successfully", book });
  });

  unlikeBook = asyncHandler(async (req, res) => {
    const book = await this.#bookService.unlikeBook(req.params.bookId, req.user._id);
    return res.json({ message: "Book unliked successfully", book });
  });
}
