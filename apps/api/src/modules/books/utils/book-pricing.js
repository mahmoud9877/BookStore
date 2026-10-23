/**
 * The shop's price rules, in one place: the book response, the cart, coupons
 * and orders all price a book through these functions. Money is in major units
 * (e.g. 320 = EGP 320), rounded to 2 decimals.
 */

/** Rounds money to 2 decimals. */
export const round2 = (amount) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100;

/**
 * A discount is active when its percentage is above 0 and it has no end date
 * or ends in the future. Books saved before discounts existed have none.
 */
export function isDiscountActive(book, now = new Date()) {
  const percent = Number(book?.discountPercent) || 0;
  if (percent <= 0) return false;
  const endsAt = book.discountEndsAt;
  return endsAt == null || new Date(endsAt) > now;
}

/** The discount percentage that applies now (0 when none is active). */
export const activeDiscountPercent = (book, now = new Date()) =>
  isDiscountActive(book, now) ? Number(book.discountPercent) : 0;

/** What one copy costs now: the list price less any active discount. */
export function salePriceOf(book, now = new Date()) {
  const price = Number(book?.price) || 0;
  const percent = activeDiscountPercent(book, now);
  return percent ? round2((price * (100 - percent)) / 100) : price;
}
