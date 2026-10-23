import { PERMISSIONS } from "../../roles/constants/permissions.js";
import { SHOP_NOTIFICATION_TYPES as T } from "../../notifications/constants/shop-notifications.js";

/** A for-sale book whose shop stock falls to this or fewer triggers a "low stock" notice. */
export const LOW_STOCK_THRESHOLD = 3;

/** The short order number customers and staff see: the id's last 6 characters, upper-case. */
export const orderReference = (orderId) => String(orderId).slice(-6).toUpperCase();

/**
 * In-app notifications about orders: the customer hears about their order,
 * staff (by permission) about new orders and low stock. Every method swallows
 * and logs its own failures, so a notification problem never fails an order.
 */
export class OrderNotifier {
  #notifications;
  #roles;
  #users;

  constructor({ notificationService, roleService, userRepository }) {
    this.#notifications = notificationService;
    this.#roles = roleService;
    this.#users = userRepository;
  }

  /** An order is confirmed (cash/free order placed): customer + staff. */
  orderPlaced(order, customer) {
    return this.#safely(T.orderPlaced, async () => {
      await this.#toCustomer(order, T.orderPlaced, { total: order.finalPrice });
      await this.#newOrderToStaff(order, customer);
    });
  }

  /** A card payment went through: customer + staff. */
  paymentConfirmed(order) {
    return this.#safely(T.orderPaymentConfirmed, async () => {
      await this.#toCustomer(order, T.orderPaymentConfirmed, { total: order.finalPrice });
      await this.#newOrderToStaff(order);
    });
  }

  paymentFailed(order) {
    return this.#safely(T.orderPaymentFailed, () => this.#toCustomer(order, T.orderPaymentFailed));
  }

  delivered(order) {
    return this.#safely(T.orderDelivered, () => this.#toCustomer(order, T.orderDelivered));
  }

  cancelled(order) {
    return this.#safely(T.orderCancelled, () => this.#toCustomer(order, T.orderCancelled));
  }

  /**
   * Notifies staff about each for-sale book this order took from above the
   * threshold to the threshold or below.
   * @param {{ book: object, quantity: number }[]} reserved books as they were before the order
   */
  stockTaken(order, reserved) {
    return this.#safely(T.stockLow, async () => {
      const crossed = reserved.filter(({ book, quantity }) => {
        const before = Number(book.quantity ?? 0);
        return book.isForSale !== false && before > LOW_STOCK_THRESHOLD && before - quantity <= LOW_STOCK_THRESHOLD;
      });
      if (!crossed.length) return;
      const staff = await this.#roles.userIdsWithPermission(PERMISSIONS.BooksManage);
      for (const { book, quantity } of crossed) {
        const data = { bookId: String(book._id), title: book.bookTitle, quantity: Number(book.quantity) - quantity };
        await this.#notifications.notifyUsers(staff, T.stockLow, data, `${order._id}:${book._id}`);
      }
    });
  }

  #toCustomer(order, type, extra = {}) {
    const data = { orderId: String(order._id), reference: orderReference(order._id), ...extra };
    return this.#notifications.notifyUsers([order.userId], type, data, String(order._id));
  }

  async #newOrderToStaff(order, customer) {
    const staff = await this.#roles.userIdsWithPermission(PERMISSIONS.OrdersManage);
    if (!staff.length) return;
    const name = customer?.userName ?? (await this.#users.findById(order.userId, { select: "userName" }))?.userName;
    const data = {
      orderId: String(order._id),
      reference: orderReference(order._id),
      total: order.finalPrice,
      customerName: name ?? "A customer",
    };
    await this.#notifications.notifyUsers(staff, T.orderNew, data, String(order._id));
  }

  async #safely(type, send) {
    try {
      await send();
    } catch (error) {
      console.error(`[notifications] ${type} failed: ${error.message}`);
    }
  }
}
