// Values are persisted in orders.status; do not rename them.
export const ORDER_STATUSES = Object.freeze({
  waitPayment: "waitPayment",
  placed: "placed",
  canceled: "canceled",
  rejected: "rejected",
  onWay: "onWay",
  delivered: "delivered",
});
