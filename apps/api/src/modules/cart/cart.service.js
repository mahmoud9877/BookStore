import { CartResponseDto } from "./cart.dto.js";
import { BadRequestError, NotFoundError } from "../../core/http-errors.js";

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
    const book = await this.#books.findById(bookId);
    if (!book) throw new NotFoundError("Book not found");
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
    if (existingItem) {
      if (existingItem.quantity + quantity > book.quantity) {
        throw new BadRequestError("Updated quantity exceeds available stock");
      }
      existingItem.quantity += quantity;
    } else {
      cart.books.push(item);
    }

    return { cart: CartResponseDto.from(await this.#carts.save(cart)), created: false };
  }

  async removeItem(userId, bookId) {
    const cart = await this.#findCart(userId);
    const index = cart.books.findIndex(isSameBook(bookId));
    if (index === -1) throw new NotFoundError("Book not found in cart");
    cart.books.splice(index, 1);
    return CartResponseDto.from(await this.#carts.save(cart));
  }

  async clearCart(userId) {
    const cart = await this.#carts.clearByUserId(userId);
    if (!cart) throw new NotFoundError("Cart not found");
    return CartResponseDto.from(cart);
  }

  async #findCart(userId) {
    const cart = await this.#carts.findByUserId(userId);
    if (!cart) throw new NotFoundError("Cart not found");
    return cart;
  }
}
