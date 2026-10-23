import { COUPON_TYPES } from "../models/coupon.model.js";
import { round2 } from "../../books/utils/book-pricing.js";

/**
 * Why `coupon` cannot be used on a cart worth `subtotal`, or null when it can.
 * The same rules apply to POST /coupons/check and to placing an order.
 */
export function couponProblem(coupon, subtotal, now = new Date()) {
  if (!coupon) return "Coupon not found";
  if (coupon.isActive === false) return "This coupon is no longer active";
  if (coupon.expiresAt != null && new Date(coupon.expiresAt) <= now) return "This coupon has expired";
  if (coupon.maxUses != null && (coupon.usedCount ?? 0) >= coupon.maxUses) return "This coupon has reached its usage limit";
  const minOrder = coupon.minOrder ?? 0;
  if (subtotal < minOrder) return `Spend at least ${minOrder} to use this coupon`;
  return null;
}

/** The amount `coupon` takes off a cart worth `subtotal` (never more than the subtotal). */
export function couponDiscount(coupon, subtotal) {
  const amount = coupon.type === COUPON_TYPES.percent ? (subtotal * coupon.value) / 100 : coupon.value;
  return round2(Math.min(Math.max(amount, 0), subtotal));
}
