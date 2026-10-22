const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days late (partial days count as a full day); 0 when on time. */
export function daysLate(dueAt, returnedAt) {
  const late = new Date(returnedAt).getTime() - new Date(dueAt).getTime();
  return late > 0 ? Math.ceil(late / DAY_MS) : 0;
}

/**
 * The overdue fine for a loan under the library's settings (`fines` section):
 * `overduePerDay` for each day beyond `graceDays`, capped by `maxOverduePerLoan`.
 * Resolves 0 when no fine applies. Amounts are minor units.
 */
export function overdueFine({ dueAt, returnedAt }, { overduePerDay, graceDays, maxOverduePerLoan }) {
  const chargeableDays = Math.max(0, daysLate(dueAt, returnedAt) - graceDays);
  const fine = chargeableDays * overduePerDay;
  return maxOverduePerLoan == null ? fine : Math.min(fine, maxOverduePerLoan);
}

/** The fee for a lost copy: the configured flat fee, else the copy's recorded cost. */
export const lostItemFee = (copy, { lostItemFee: flatFee }) => (flatFee == null ? copy.cost ?? 0 : flatFee);

/** Formats minor units for messages: 1250 EGP -> "12.50 EGP". */
export const formatAmount = (amount, currency) => `${(amount / 100).toFixed(2)} ${currency}`;
