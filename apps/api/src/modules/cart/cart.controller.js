import cartModel from "./cart.model.js";
import bookModel from "../books/book.model.js";
import { asyncHandler } from "../../middleware/error-handler.js";

export const getCart = asyncHandler(async (req, res) => {
  const cart = await cartModel.findOne({ userId: req.user._id });
  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }
  return res.json({ message: "Done", cart });
});

export const addToCart = asyncHandler(async (req, res) => {
  const { bookId } = req.body;
  const quantity = Number(req.body.quantity);

  // `book.quantity` is the number of copies in stock.
  const book = await bookModel.findById(bookId);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }
  if (book.quantity < quantity) {
    return res.status(400).json({ message: "Insufficient stock available" });
  }

  const cartItem = {
    bookId,
    bookTitle: book.bookTitle,
    price: book.price,
    quantity,
    image: book.image,
  };

  const cart = await cartModel.findOne({ userId: req.user._id });
  if (!cart) {
    const newCart = await cartModel.create({
      userId: req.user._id,
      books: [cartItem],
    });
    return res.status(201).json({ message: "Cart created", newCart });
  }

  const existingItem = cart.books.find((item) => item.bookId.toString() === bookId);
  if (existingItem) {
    if (existingItem.quantity + quantity > book.quantity) {
      return res
        .status(400)
        .json({ message: "Updated quantity exceeds available stock" });
    }
    existingItem.quantity += quantity;
  } else {
    cart.books.push(cartItem);
  }

  await cart.save();
  return res.status(200).json({ message: "Cart updated", cart });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const cart = await cartModel.findOne({ userId: req.user._id });
  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }

  const itemIndex = cart.books.findIndex((item) => item.bookId.toString() === bookId);
  if (itemIndex === -1) {
    return res.status(404).json({ message: "Book not found in cart" });
  }

  cart.books.splice(itemIndex, 1);
  await cart.save();
  return res.status(200).json({ message: "Book removed from cart", cart });
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartModel.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { books: [] } },
    { new: true }
  );
  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }
  return res.status(200).json({ message: "Cart cleared successfully", cart });
});
