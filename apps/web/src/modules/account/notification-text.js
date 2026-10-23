import { formatPrice, formatTitle } from "../../lib/format.js";
import { t } from "../../i18n/index.js";

const has = (data, fields) => fields.every((field) => data?.[field] != null && data[field] !== "");

/*
 * Shop notifications carry their values in `data` so they read in the interface
 * language; `needs` lists the values a message requires (otherwise the stored
 * English subject/body is shown). Customers have no order history page yet, so
 * their order messages open the cart.
 */
const SHOP_TYPES = {
  "order.placed": {
    needs: ["reference", "total"],
    link: "/cart",
    text: (d) => [t("Order placed"), t("Your order #{reference} for {total} has been placed.", { reference: d.reference, total: formatPrice(d.total) })],
  },
  "order.payment_confirmed": {
    needs: ["reference"],
    link: "/cart",
    text: (d) => [t("Payment received"), t("We received your payment for order #{reference}.", { reference: d.reference })],
  },
  "order.payment_failed": {
    needs: ["reference"],
    link: "/cart",
    text: (d) => [t("Payment failed"), t("The payment for order #{reference} didn't go through, so the order was cancelled.", { reference: d.reference })],
  },
  "order.delivered": {
    needs: ["reference"],
    link: "/cart",
    text: (d) => [t("Order delivered"), t("Your order #{reference} has been delivered.", { reference: d.reference })],
  },
  "order.cancelled": {
    needs: ["reference"],
    link: "/cart",
    text: (d) => [t("Order cancelled"), t("Your order #{reference} has been cancelled.", { reference: d.reference })],
  },
  "order.new": {
    needs: ["reference", "total", "customerName"],
    link: "/dashboard",
    text: (d) => [
      t("New order"),
      t("{customerName} placed order #{reference} for {total}.", { customerName: d.customerName, reference: d.reference, total: formatPrice(d.total) }),
    ],
  },
  "stock.low": {
    needs: ["title", "quantity"],
    link: "/dashboard/books",
    text: (d) => [
      t("Low stock"),
      Number(d.quantity) > 0
        ? t("Only {quantity} left of “{title}”.", { quantity: d.quantity, title: formatTitle(d.title) })
        : t("“{title}” is out of stock.", { title: formatTitle(d.title) }),
    ],
  },
};

/**
 * What to show for an in-app notification: `{ title, body, link }` in the
 * interface language. Library notifications (loans, fines…) keep the subject and
 * body the API stored; `link` is null when the message has no page to open.
 */
export function notificationText(notification) {
  const kind = SHOP_TYPES[notification?.type];
  const data = notification?.data ?? {};
  if (kind && has(data, kind.needs)) {
    const [title, body] = kind.text(data);
    return { title, body, link: kind.link };
  }
  return { title: notification?.subject ?? "", body: notification?.body ?? "", link: kind?.link ?? null };
}
