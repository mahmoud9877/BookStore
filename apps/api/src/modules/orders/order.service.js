import { OrderPolicy } from "./order-policy.js";
import { ORDER_STATUSES } from "./order-statuses.js";
import { PAYMENT_OUTCOMES } from "./payment-gateway.js";
import { CheckoutSessionResponseDto, OrderResponseDto } from "./order.dto.js";
import {
  BadGatewayError,
  BadRequestError,
  ServiceUnavailableError,
  ensureFound,
} from "../../core/http-errors.js";

export class OrderService {
  #orders;
  #carts;
  #books;
  #payments;

  /** `paymentGateway` implements the port described in ./payment-gateway.js. */
  constructor({ orderRepository, cartRepository, bookRepository, paymentGateway }) {
    this.#orders = orderRepository;
    this.#carts = cartRepository;
    this.#books = bookRepository;
    this.#payments = paymentGateway;
  }

  /**
   * Turns the user's cart into an order. Card orders also get a checkout
   * session. Resolves `{ order, session }` (`session` is null for cash).
   * @param {import("./order.dto.js").CreateOrderDto} dto
   */
  async placeOrder(user, { address, phone, note, paymentType }) {
    if (paymentType === "card" && !this.#payments.isConfigured) {
      throw new ServiceUnavailableError("Card payments are not configured");
    }

    const cart = await this.#carts.findByUserId(user._id);
    if (!cart?.books?.length) throw new BadRequestError("Empty Cart");

    const items = await this.#reserveStock(cart.books);
    const order = await this.#createOrReleaseStock(items, {
      userId: user._id,
      address,
      note,
      phone,
      paymentType,
    });
    const session = paymentType === "card" ? await this.#startCheckout(order, items, user.email) : null;

    // Only empty the cart once the order (and payment session) definitely exists.
    await this.#carts.clearByUserId(user._id);
    return {
      order: OrderResponseDto.from(order),
      session: CheckoutSessionResponseDto.from(session),
    };
  }

  /**
   * Verifies a payment provider webhook and applies its outcome to the order.
   * An invalid signature throws BadRequestError. Resolves a short outcome message.
   */
  async processPaymentWebhook(rawBody, signature) {
    const { outcome, orderId } = this.#payments.parseWebhookEvent(rawBody, signature);
    if (!orderId || outcome === PAYMENT_OUTCOMES.ignored) return "Ignored";

    if (outcome === PAYMENT_OUTCOMES.paid) {
      await this.#orders.updateStatus(orderId, ORDER_STATUSES.placed);
      return "Done";
    }
    const rejected = await this.#orders.rejectIfAwaitingPayment(orderId);
    if (rejected) await this.#books.releaseStock(rejected.books);
    return "rejected link";
  }

  /** @param {import("./order.dto.js").CancelOrderDto} dto */
  async cancelOrder({ orderId, reason }, userId) {
    const order = await this.#orders.findByIdForUser(orderId, userId);
    if (!order) throw new BadRequestError("In-Valid OrderId");
    if (!OrderPolicy.canBeCancelled(order)) {
      throw new BadRequestError(`Cannot cancel your order after it been changed to ${order.status}`);
    }

    const canceled = await this.#orders.updateStatus(orderId, ORDER_STATUSES.canceled, {
      updatedBy: userId,
      reason,
    });
    await this.#books.releaseStock(order.books);
    return OrderResponseDto.from(canceled);
  }

  async deliverOrder(orderId, adminId) {
    const order = await this.#orders.findById(orderId);
    if (!order) throw new BadRequestError("Invalid order");
    if (!OrderPolicy.canBeDelivered(order)) {
      throw new BadRequestError("Cannot update your order after it has been changed");
    }
    const delivered = await this.#orders.updateStatus(orderId, ORDER_STATUSES.delivered, {
      updatedBy: adminId,
    });
    return OrderResponseDto.from(ensureFound(delivered, "Order not found"));
  }

  /** Reserves stock for every cart item and returns the priced order lines. */
  async #reserveStock(cartItems) {
    const result = await this.#books.reserveStock(cartItems);
    if (result.unavailable) {
      const { bookTitle, bookId } = result.unavailable;
      throw new BadRequestError(`Book unavailable or out of stock: ${bookTitle ?? bookId}`);
    }
    return result.reserved.map(({ book, quantity }) => ({
      bookId: book._id,
      bookTitle: book.bookTitle,
      quantity,
      unitPrice: book.price,
      finalPrice: book.price * quantity,
    }));
  }

  async #createOrReleaseStock(items, { paymentType, ...details }) {
    const subtotal = items.reduce((sum, item) => sum + item.finalPrice, 0);
    try {
      return await this.#orders.create({
        ...details,
        books: items,
        subtotal,
        finalPrice: subtotal,
        paymentType,
        status: OrderPolicy.initialStatus(paymentType),
      });
    } catch (error) {
      await this.#books.releaseStock(items);
      throw error;
    }
  }

  /** Opens a checkout session; on failure the order is rejected and its stock released. */
  async #startCheckout(order, items, customerEmail) {
    try {
      return await this.#payments.createCheckout({
        orderId: order._id.toString(),
        customerEmail,
        items: items.map(({ bookTitle, unitPrice, quantity }) => ({ name: bookTitle, unitPrice, quantity })),
      });
    } catch (error) {
      console.error("Checkout session creation failed:", error.message);
      await this.#orders.updateStatus(order._id, ORDER_STATUSES.rejected);
      await this.#books.releaseStock(items);
      throw new BadGatewayError("Stripe session creation failed");
    }
  }
}
