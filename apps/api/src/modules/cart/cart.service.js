import { CartResponseDto } from "./cart.dto.js";
import { BadRequestError, NotFoundError, ensureFound } from "../../core/http-errors.js";

const CART_NOT_FOUND = "Cart not found";

const isSameBook = (bookId) => (item) => item.bookId.toString() === String(bookId);

export class CartService {
  #carts;
  #books;

  constructor({ cartRepository, bookRepository }) {
    this.#carts = cartRepository;
    this.#books = bookRepository;
  }

  async getCart(userId) {
    return CartResponseDto.from(await this.#findCart(userId));
  }

  /**
   * Adds copies of a book, never exceeding its stock (`book.quantity`).
   * Resolves `{ cart, created }`; `created` is true when this was the user's first item.
   * @param {import("./cart.dto.js").AddToCartDto} dto
   */
  async addItem(userId, { bookId, quantity }) {
    const book = ensureFound(await this.#books.findById(bookId), "Book not found");
    if (book.isForSale === false) throw new BadRequestError("This book is not for sale");
    if (book.quantity < quantity) throw new BadRequestError("Insufficient stock available");

    const item = {
      bookId,
      bookTitle: book.bookTitle,
      price: book.price,
      quantity,
      image: book.image,
    };

    const cart = await this.#carts.findByUserId(userId);
    if (!cart) {
      const created = await this.#carts.createForUser(userId, [item]);
      return { cart: CartResponseDto.from(created), created: true };
    }

    const existingItem = cart.books.find(isSameBook(bookId));
    if (existingItem && existingItem.quantity + quantity > book.quantity) {
      throw new BadRequestError("Updated quantity exceeds available stock");
    }
    const updated = existingItem
      ? await this.#carts.incrementItemQuantity(userId, bookId, quantity)
      : await this.#carts.addItem(userId, item);
    return { cart: CartResponseDto.from(updated), created: false };
  }

  async removeItem(userId, bookId) {
    const cart = await this.#carts.removeItem(userId, bookId);
    if (cart) return CartResponseDto.from(cart);
    await this.#findCart(userId); // throws "Cart not found" when there is no cart at all
    throw new NotFoundError("Book not found in cart");
  }

  async clearCart(userId) {
    return CartResponseDto.from(ensureFound(await this.#carts.clearByUserId(userId), CART_NOT_FOUND));
  }

  async #findCart(userId) {
    return ensureFound(await this.#carts.findByUserId(userId), CART_NOT_FOUND);
  }
}
