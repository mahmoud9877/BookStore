import { ORDER_STATUSES } from "../constants/order-statuses.js";

/** Business rules for an order's status lifecycle. */
export const OrderPolicy = Object.freeze({
  /** Card orders wait for payment; cash orders are placed immediately. */
  initialStatus(paymentType) {
    return paymentType === "card" ? ORDER_STATUSES.waitPayment : ORDER_STATUSES.placed;
  },

  /** Customers may cancel until a cash order ships or a card order is paid. */
  canBeCancelled({ paymentType, status }) {
    return (
      (paymentType === "cash" && status === ORDER_STATUSES.placed) ||
      (paymentType === "card" && status === ORDER_STATUSES.waitPayment)
    );
  },

  /** Only placed or in-transit orders can be marked delivered. */
  canBeDelivered({ status }) {
    return status === ORDER_STATUSES.placed || status === ORDER_STATUSES.onWay;
  },
});
