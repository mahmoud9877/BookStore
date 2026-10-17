import { asyncHandler } from "../../middleware/error-handler.js";

export class CartController {
  #cartService;

  constructor(cartService) {
    this.#cartService = cartService;
  }

  getCart = asyncHandler(async (req, res) => {
    const cart = await this.#cartService.getCart(req.user._id);
    return res.json({ message: "Done", cart });
  });

  addToCart = asyncHandler(async (req, res) => {
    const { bookId, quantity } = req.body;
    const { cart, created } = await this.#cartService.addItem(req.user._id, bookId, Number(quantity));
    if (created) {
      return res.status(201).json({ message: "Cart created", newCart: cart });
    }
    return res.status(200).json({ message: "Cart updated", cart });
  });

  removeCartItem = asyncHandler(async (req, res) => {
    const cart = await this.#cartService.removeItem(req.user._id, req.params.bookId);
    return res.status(200).json({ message: "Book removed from cart", cart });
  });

  clearCart = asyncHandler(async (req, res) => {
    const cart = await this.#cartService.clearCart(req.user._id);
    return res.status(200).json({ message: "Cart cleared successfully", cart });
  });
}
