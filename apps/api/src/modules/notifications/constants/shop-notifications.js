// In-app notifications about the shop (orders and stock). Values are persisted
// in notifications.type and read by the website; do not rename them.
export const SHOP_NOTIFICATION_TYPES = Object.freeze({
  orderPlaced: "order.placed",
  orderPaymentConfirmed: "order.payment_confirmed",
  orderPaymentFailed: "order.payment_failed",
  orderDelivered: "order.delivered",
  orderCancelled: "order.cancelled",
  orderNew: "order.new",
  stockLow: "stock.low",
});

const T = SHOP_NOTIFICATION_TYPES;
const money = (amount) => `${Number(amount ?? 0).toFixed(2)} EGP`;

/**
 * English subject/body stored with each notification (a fallback: clients
 * translate from `type` + `data`).
 */
export const SHOP_MESSAGES = Object.freeze({
  [T.orderPlaced]: (d) => ({ subject: "Order placed", body: `Your order #${d.reference} for ${money(d.total)} has been placed.` }),
  [T.orderPaymentConfirmed]: (d) => ({ subject: "Payment received", body: `We received your payment for order #${d.reference}.` }),
  [T.orderPaymentFailed]: (d) => ({
    subject: "Payment failed",
    body: `The payment for order #${d.reference} didn't go through, so the order was cancelled.`,
  }),
  [T.orderDelivered]: (d) => ({ subject: "Order delivered", body: `Your order #${d.reference} has been delivered.` }),
  [T.orderCancelled]: (d) => ({ subject: "Order cancelled", body: `Your order #${d.reference} has been cancelled.` }),
  [T.orderNew]: (d) => ({ subject: "New order", body: `${d.customerName} placed order #${d.reference} for ${money(d.total)}.` }),
  [T.stockLow]: (d) => ({ subject: "Low stock", body: `Only ${d.quantity} left of “${d.title}”.` }),
});
