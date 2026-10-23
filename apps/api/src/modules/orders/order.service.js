import { OrderPolicy } from "./order-policy.js";
import { ORDER_STATUSES } from "./order-statuses.js";
import { PAYMENT_OUTCOMES } from "./payment-gateway.js";
import { CheckoutSessionResponseDto, OrderResponseDto } from "./order.dto.js";
import { round2, salePriceOf } from "../books/book-pricing.js";
import { couponDiscount, couponProblem } from "../coupons/coupon-rules.js";
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
  #coupons;
  #payments;
  #notifier;

  /**
   * `paymentGateway` implements the port described in ./payment-gateway.js.
   * `orderNotifier` (optional) sends the in-app notifications; it never throws.
   */
  constructor({ orderRepository, cartRepository, bookRepository, couponRepository, paymentGateway, orderNotifier }) {
    this.#orders = orderRepository;
    this.#carts = cartRepository;
    this.#books = bookRepository;
    this.#coupons = couponRepository;
    this.#payments = paymentGateway;
    this.#notifier = orderNotifier ?? null;
  }

  /**
   * Turns the user's cart into an order. Card orders also get a checkout
   * session. Lines are priced at the books' current sale prices; a `couponCode`
   * is checked and one use of it claimed. Resolves `{ order, session }`
   * (`session` is null for cash).
   * @param {import("./order.dto.js").CreateOrderDto} dto
   */
  async placeOrder(user, { address, phone, note, paymentType, couponCode }) {
    if (paymentType === "card" && !this.#payments.isConfigured) {
      throw new ServiceUnavailableError("Card payments are not configured");
    }

    const cart = await this.#carts.findByUserId(user._id);
    if (!cart?.books?.length) throw new BadRequestError("Empty Cart");

    // Fail fast on an unknown, inactive, expired or used-up code before touching stock.
    const coupon = couponCode ? await this.#coupons.findByCode(couponCode) : null;
    if (couponCode) {
      const problem = couponProblem(coupon, Infinity);
      if (problem) throw new BadRequestError(problem);
    }

    const { items, reserved } = await this.#reserveStock(cart.books);
    const subtotal = round2(items.reduce((sum, item) => sum + item.finalPrice, 0));
    const discount = coupon ? await this.#claimCouponOrReleaseStock(coupon, subtotal, items) : 0;
    // A coupon that covers the whole order leaves nothing to charge: Stripe refuses a
    // zero-amount session, so the order is placed like a cash order with nothing to collect.
    const payBy = paymentType === "card" && round2(subtotal - discount) <= 0 ? "cash" : paymentType;
    const order = await this.#createOrRelease(items, {
      userId: user._id,
      address,
      note,
      phone,
      paymentType: payBy,
      subtotal,
      discount,
      coupon: coupon ? { code: coupon.code, discount } : null,
    });
    const session = payBy === "card" ? await this.#startCheckout(order, items, user.email) : null;

    // Only empty the cart once the order (and payment session) definitely exists.
    await this.#carts.clearByUserId(user._id);

    // Card orders are announced once paid (see applyPaymentEvent).
    if (payBy === "cash") await this.#notifier?.orderPlaced(order, user);
    await this.#notifier?.stockTaken(order, reserved);
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
    return this.applyPaymentEvent(this.#payments.parseWebhookEvent(rawBody, signature));
  }

  /** Applies an already verified payment event to its order. */
  async applyPaymentEvent({ outcome, orderId }) {
    if (!orderId || outcome === PAYMENT_OUTCOMES.ignored) return "Ignored";

    if (outcome === PAYMENT_OUTCOMES.paid) {
      const paid = await this.#orders.updateStatus(orderId, ORDER_STATUSES.placed);
      if (paid) await this.#notifier?.paymentConfirmed(paid);
      return "Done";
    }
    const rejected = await this.#orders.rejectIfAwaitingPayment(orderId);
    if (rejected) {
      await this.#books.releaseStock(rejected.books);
      await this.#releaseCoupon(rejected);
      await this.#notifier?.paymentFailed(rejected);
    }
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
    await this.#releaseCoupon(order);
    await this.#notifier?.cancelled(canceled ?? order);
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
    ensureFound(delivered, "Order not found");
    await this.#notifier?.delivered(delivered);
    return OrderResponseDto.from(delivered);
  }

  /**
   * Reserves stock for every cart item. Resolves the priced order lines
   * (`items`) and the books as they were before the reservation (`reserved`).
   */
  async #reserveStock(cartItems) {
    const result = await this.#books.reserveStock(cartItems);
    if (result.unavailable) {
      const { bookTitle, bookId } = result.unavailable;
      throw new BadRequestError(`Book unavailable or out of stock: ${bookTitle ?? bookId}`);
    }
    const items = result.reserved.map(({ book, quantity }) => {
      const unitPrice = salePriceOf(book);
      return {
        bookId: book._id,
        bookTitle: book.bookTitle,
        quantity,
        unitPrice,
        finalPrice: round2(unitPrice * quantity),
      };
    });
    return { items, reserved: result.reserved };
  }

  /**
   * Checks the coupon against the priced order and claims one use atomically
   * (a concurrent order may have taken the last use). On failure the reserved
   * stock is put back. Resolves the discount.
   */
  async #claimCouponOrReleaseStock(coupon, subtotal, items) {
    let problem = couponProblem(coupon, subtotal);
    if (!problem && !(await this.#coupons.claim(coupon._id))) {
      const current = await this.#coupons.findById(coupon._id);
      problem = couponProblem(current, subtotal) ?? "This coupon has reached its usage limit";
    }
    if (problem) {
      await this.#books.releaseStock(items);
      throw new BadRequestError(problem);
    }
    return couponDiscount(coupon, subtotal);
  }

  async #createOrRelease(items, { paymentType, subtotal, discount, ...details }) {
    try {
      return await this.#orders.create({
        ...details,
        books: items,
        subtotal,
        discount,
        finalPrice: round2(subtotal - discount),
        paymentType,
        status: OrderPolicy.initialStatus(paymentType),
      });
    } catch (error) {
      await this.#books.releaseStock(items);
      await this.#releaseCoupon(details);
      throw error;
    }
  }

  /** Gives back the coupon use an order claimed (cancelled, rejected or never created). */
  async #releaseCoupon(order) {
    if (order?.coupon?.code) await this.#coupons.release(order.coupon.code);
  }

  /** Opens a checkout session; on failure the order is rejected and its stock released. */
  async #startCheckout(order, items, customerEmail) {
    try {
      return await this.#payments.createCheckout({
        orderId: order._id.toString(),
        customerEmail,
        items: items.map(({ bookTitle, unitPrice, quantity }) => ({ name: bookTitle, unitPrice, quantity })),
        ...(order.discount > 0 ? { discount: { amount: order.discount, name: order.coupon?.code } } : {}),
      });
    } catch (error) {
      console.error("Checkout session creation failed:", error.message);
      await this.#orders.updateStatus(order._id, ORDER_STATUSES.rejected);
      await this.#books.releaseStock(items);
      await this.#releaseCoupon(order);
      throw new BadGatewayError("Stripe session creation failed");
    }
  }
}
