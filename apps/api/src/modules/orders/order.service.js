import { ORDER_STATUSES } from "./order.model.js";
import { CheckoutSessionResponseDto, OrderResponseDto } from "./order.dto.js";
import { BadGatewayError, BadRequestError, ServiceUnavailableError } from "../../core/http-errors.js";

const CHECKOUT_FAILURE_EVENTS = [
  "checkout.session.expired",
  "checkout.session.async_payment_failed",
];

const NOT_DELIVERABLE = [
  ORDER_STATUSES.waitPayment,
  ORDER_STATUSES.canceled,
  ORDER_STATUSES.rejected,
  ORDER_STATUSES.delivered,
];

export class OrderService {
  #orders;
  #carts;
  #books;
  #payments;

  constructor({ orderRepository, cartRepository, bookRepository, paymentGateway }) {
    this.#orders = orderRepository;
    this.#carts = cartRepository;
    this.#books = bookRepository;
    this.#payments = paymentGateway;
  }

  /**
   * Turns the user's cart into an order. Card orders also get a Stripe Checkout
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
    const subtotal = items.reduce((sum, item) => sum + item.finalPrice, 0);

    let order;
    try {
      order = await this.#orders.create({
        userId: user._id,
        address,
        note,
        phone,
        books: items,
        subtotal,
        finalPrice: subtotal,
        paymentType,
        status: paymentType === "card" ? ORDER_STATUSES.waitPayment : ORDER_STATUSES.placed,
      });
    } catch (error) {
      await this.#releaseStock(items);
      throw error;
    }

    let session;
    if (paymentType === "card") {
      try {
        session = await this.#startCheckout(order, items, user.email);
      } catch (error) {
        console.error("Stripe session creation failed:", error.message);
        await this.#orders.updateStatus(order._id, ORDER_STATUSES.rejected);
        await this.#releaseStock(items);
        throw new BadGatewayError("Stripe session creation failed");
      }
    }

    // Only empty the cart once the order (and payment session) definitely exists.
    await this.#carts.clearByUserId(user._id);
    return {
      order: OrderResponseDto.from(order),
      session: CheckoutSessionResponseDto.from(session),
    };
  }

  /**
   * Verifies a raw Stripe webhook payload and applies it to its order.
   * An invalid signature throws BadRequestError. Resolves a short outcome message.
   */
  async processStripeWebhook(rawBody, signature) {
    return this.#applyCheckoutEvent(this.#payments.constructWebhookEvent(rawBody, signature));
  }

  async #applyCheckoutEvent(event) {
    const orderId = event.data?.object?.metadata?.orderId;
    if (!orderId) return "Ignored";

    if (event.type === "checkout.session.completed") {
      await this.#orders.updateStatus(orderId, ORDER_STATUSES.placed);
      return "Done";
    }
    if (CHECKOUT_FAILURE_EVENTS.includes(event.type)) {
      const order = await this.#orders.rejectIfAwaitingPayment(orderId);
      if (order) await this.#releaseStock(order.books);
      return "rejected link";
    }
    return "Ignored";
  }

  /**
   * Customers may cancel their own order until it ships (cash) or is paid (card).
   * @param {import("./order.dto.js").CancelOrderDto} dto
   */
  async cancelOrder({ orderId, reason }, userId) {
    const order = await this.#orders.findByIdForUser(orderId, userId);
    if (!order) throw new BadRequestError("In-Valid OrderId");

    const cancellable =
      (order.paymentType === "cash" && order.status === ORDER_STATUSES.placed) ||
      (order.paymentType === "card" && order.status === ORDER_STATUSES.waitPayment);
    if (!cancellable) {
      throw new BadRequestError(`Cannot cancel your order after it been changed to ${order.status}`);
    }

    const canceled = await this.#orders.updateStatus(orderId, ORDER_STATUSES.canceled, {
      updatedBy: userId,
      reason,
    });
    await this.#releaseStock(order.books);
    return OrderResponseDto.from(canceled);
  }

  async deliverOrder(orderId, adminId) {
    const order = await this.#orders.findById(orderId);
    if (!order) throw new BadRequestError("Invalid order");
    if (NOT_DELIVERABLE.includes(order.status)) {
      throw new BadRequestError("Cannot update your order after it has been changed");
    }
    const delivered = await this.#orders.updateStatus(orderId, ORDER_STATUSES.delivered, {
      updatedBy: adminId,
    });
    return OrderResponseDto.from(delivered);
  }

  /**
   * Atomically reserves stock for every cart item and returns the priced order
   * lines. If any item is unavailable, already-reserved items are released.
   */
  async #reserveStock(cartItems) {
    const reserved = [];
    for (const item of cartItems) {
      const book = await this.#books.decrementStock(item.bookId, item.quantity);
      if (!book) {
        await this.#releaseStock(reserved);
        throw new BadRequestError(`Book unavailable or out of stock: ${item.bookTitle ?? item.bookId}`);
      }
      reserved.push({
        bookId: book._id,
        bookTitle: book.bookTitle,
        quantity: item.quantity,
        unitPrice: book.price,
        finalPrice: book.price * item.quantity,
      });
    }
    return reserved;
  }

  #releaseStock(items) {
    return Promise.all(
      items.map(({ bookId, quantity }) => this.#books.incrementStock(bookId, quantity))
    );
  }

  #startCheckout(order, items, customerEmail) {
    return this.#payments.createCheckoutSession({
      customerEmail,
      metadata: { orderId: order._id.toString() },
      lineItems: items.map((item) => ({
        price_data: {
          currency: "egp",
          product_data: { name: item.bookTitle || "Unknown Book" },
          unit_amount: Math.round(item.unitPrice * 100),
        },
        quantity: item.quantity,
      })),
    });
  }
}
