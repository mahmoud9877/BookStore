import bookModel from "./book.model.js";
import { uploadImage } from "../../infrastructure/cloudinary.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { categoryModel } from "../categories/category.model.js";

const IMAGE_FOLDER = "book";

async function assertCategoryExists(name) {
  if (!(await categoryModel.findOne({ name }))) {
    throw new Error("Category not found", { cause: 404 });
  }
}

/** Lists all books; `?page=&limit=` paginates when provided. */
export const listBooks = asyncHandler(async (req, res) => {
  const query = bookModel.find({}).sort({ createdAt: -1 });
  const limit = Number(req.query.limit);
  if (limit > 0) {
    const page = Math.max(Number(req.query.page) || 1, 1);
    query.skip((page - 1) * limit).limit(limit);
  }
  res.status(200).json({ book: await query });
});

export const getBookById = asyncHandler(async (req, res) => {
  const book = await bookModel.findById(req.params.bookId);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }
  return res.status(200).json({ message: "Done", book });
});

export const addBook = asyncHandler(async (req, res) => {
  const { bookTitle, author, description, price, category, quantity } = req.body;

  await assertCategoryExists(category);
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required" });
  }
  const { secure_url } = await uploadImage(req.file.path, IMAGE_FOLDER);

  const book = await bookModel.create({
    bookTitle,
    author,
    description,
    image: secure_url,
    price,
    category,
    quantity,
  });

  return res.status(201).json({ message: "Book added successfully", book });
});

export const updateBook = asyncHandler(async (req, res) => {
  const { bookTitle, author, description, price, category, quantity } = req.body;

  await assertCategoryExists(category);
  const update = { bookTitle, author, description, price, category, quantity };
  if (req.file) {
    update.image = (await uploadImage(req.file.path, IMAGE_FOLDER)).secure_url;
  }

  const book = await bookModel.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }
  return res.status(200).json({ message: "Book updated successfully", book });
});

export const deleteBook = asyncHandler(async (req, res) => {
  const book = await bookModel.findByIdAndDelete(req.params.id);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }
  return res.status(200).json({ message: "Book deleted successfully" });
});

export const likeBook = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const book = await bookModel.findOneAndUpdate(
    { _id: req.params.bookId, likes: { $ne: userId } },
    { $push: { likes: userId }, $inc: { totalLikes: 1 } },
    { new: true }
  );
  if (!book) {
    return res.status(400).json({ message: "Book not found or already liked" });
  }
  return res.json({ message: "Book liked successfully", book });
});

export const unlikeBook = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const book = await bookModel.findOneAndUpdate(
    { _id: req.params.bookId, likes: userId },
    { $pull: { likes: userId }, $inc: { totalLikes: -1 } },
    { new: true }
  );
  if (!book) {
    return res.status(400).json({ message: "Book not found or not liked yet" });
  }
  return res.json({ message: "Book unliked successfully", book });
});
