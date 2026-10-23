import { CartResponseDto } from "./cart.dto.js";
import { round2, salePriceOf } from "../books/book-pricing.js";
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
    return this.#present(await this.#findCart(userId));
  }

  /**
   * The user's cart lines at the books' current prices: `price` is the sale
   * price, `originalPrice` the list price. Resolves `{ cart, items, subtotal }`;
   * `cart` is null and `items` empty when the user has no cart.
   */
  async pricedCart(userId, knownBooks = []) {
    const cart = await this.#carts.findByUserId(userId);
    const items = cart ? await this.#priceItems(cart.books ?? [], knownBooks) : [];
    const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    return { cart, items, subtotal };
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
      price: salePriceOf(book), // informative only: responses always use the current price
      quantity,
      image: book.image,
    };

    const cart = await this.#carts.findByUserId(userId);
    if (!cart) {
      const created = await this.#carts.createForUser(userId, [item]);
      return { cart: await this.#present(created, [{ ...book, _id: bookId }]), created: true };
    }

    const existingItem = cart.books.find(isSameBook(bookId));
    if (existingItem && existingItem.quantity + quantity > book.quantity) {
      throw new BadRequestError("Updated quantity exceeds available stock");
    }
    const updated = existingItem
      ? await this.#carts.incrementItemQuantity(userId, bookId, quantity)
      : await this.#carts.addItem(userId, item);
    return { cart: await this.#present(updated, [{ ...book, _id: bookId }]), created: false };
  }

  async removeItem(userId, bookId) {
    const cart = await this.#carts.removeItem(userId, bookId);
    if (cart) return this.#present(cart);
    await this.#findCart(userId); // throws "Cart not found" when there is no cart at all
    throw new NotFoundError("Book not found in cart");
  }

  async clearCart(userId) {
    return this.#present(ensureFound(await this.#carts.clearByUserId(userId), CART_NOT_FOUND));
  }

  async #present(cart, knownBooks = []) {
    return CartResponseDto.from({ ...cart, books: await this.#priceItems(cart.books ?? [], knownBooks) });
  }

  /** Reprices lines with the books' current prices; a deleted book keeps the stored price. */
  async #priceItems(lines, knownBooks = []) {
    const books = new Map(knownBooks.filter((book) => book?._id).map((book) => [String(book._id), book]));
    const missing = [...new Set(lines.map((line) => String(line.bookId)).filter((id) => !books.has(id)))];
    if (missing.length) {
      for (const book of await this.#books.findPricing(missing)) books.set(String(book._id), book);
    }
    return lines.map((line) => {
      const book = books.get(String(line.bookId));
      return book
        ? { ...line, price: salePriceOf(book), originalPrice: Number(book.price) || 0 }
        : { ...line, originalPrice: line.price };
    });
  }

  async #findCart(userId) {
    return ensureFound(await this.#carts.findByUserId(userId), CART_NOT_FOUND);
  }
}
