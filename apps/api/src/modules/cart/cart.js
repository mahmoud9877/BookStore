import bookModel from "../../../DB/modules/bookModel.js";
import cartModel from "../../../DB/modules/cartModel.js";
import { asyncHandler } from "../../utils/errorHandling.js";

// Add to cart handler
export const getCart = asyncHandler(async (req, res, next) => {
  try {
    const cart = await cartModel.findOne({ userId: req.user._id });
    console.log(cart);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    return res.json({ message: "Done", cart });
  } catch (error) {
    console.error("Error fetching cart:", error);
    next(error);
  }
});

export const addToCart = asyncHandler(async (req, res, next) => {
  const { bookId, quantity } = req.body;

  // Validate that bookId and quantity are provided and valid
  if (!bookId || quantity == null || quantity <= 0) {
    return res
      .status(400)
      .json({ message: "Book ID and a positive quantity are required" });
  }

  // Check if the book exists and has enough stock
  const book = await bookModel.findById(bookId);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  if (book.stock < quantity) {
    return res.status(400).json({ message: "Insufficient stock available" });
  }

  // Ensure that `req.user._id` exists
  if (!req.user || !req.user._id) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  // Find the user's cart
  let cart = await cartModel.findOne({ userId: req.user._id });

  if (!cart) {
    // Create a new cart if it doesn't exist
    try {
      const newCart = await cartModel.create({
        userId: req.user._id,
        books: [
          {
            bookId,
            bookTitle: book.bookTitle,
            price: book.price,
            quantity,
            image: book.image, // Include the image URL here
          },
        ],
      });
      return res.status(201).json({ message: "Cart created", newCart });
    } catch (error) {
      console.error("Error creating cart:", error);
      return res.status(500).json({ message: "Failed to create cart" });
    }
  }

  // Ensure cart.books array exists
  if (!Array.isArray(cart.books)) {
    cart.books = [];
  }

  // Check if the book is already in the cart
  const cartBook = cart.books.find((item) => item.bookId.toString() === bookId);

  if (cartBook) {
    // Update the quantity if the book already exists in the cart
    cartBook.quantity += quantity;

    // Optional: Check if updated quantity exceeds stock
    if (cartBook.quantity > book.stock) {
      return res
        .status(400)
        .json({ message: "Updated quantity exceeds available stock" });
    }
  } else {
    // Add new book to cart if not found
    cart.books.push({
      bookId,
      bookTitle: book.bookTitle,
      price: book.price,
      quantity,
      image: book.image, // Include the image URL here
    });
  }

  // Save the updated cart
  await cart.save();
  return res.status(200).json({ message: "Cart updated", cart });
});

export const deleteCartItem = asyncHandler(async (req, res) => {
  const { bookId } = req.params; // Extract the bookId from the route parameter
  const userId = req.user._id; // Extract userId from the authenticated user

  try {
    // Find the user's cart by userId
    const cart = await cartModel.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find index of the book to remove
    const bookIndex = cart.books.findIndex(
      (item) => item.bookId.toString() === bookId
    );

    // If book is not in the cart
    if (bookIndex === -1) {
      return res.status(404).json({ message: "Book not found in cart" });
    }

    // Remove the book from the cart
    cart.books.splice(bookIndex, 1);

    // Save the updated cart
    await cart.save();

    res.status(200).json({ message: "Book removed from cart", cart });
  } catch (error) {
    console.error("Error deleting book from cart:", error);
    res.status(500).json({ message: "Failed to delete book from cart" });
  }
});

export const clearCart = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id; // Assuming you set req.user in your auth middleware
    const cart = await cartController.clearAllCart(userId);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    res.status(200).json({ message: "Cart cleared successfully", cart });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res
      .status(500)
      .json({ message: "Failed to clear cart", error: error.message });
  }
});
