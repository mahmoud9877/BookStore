// Values are persisted; do not rename them.
export const FINE_TYPES = Object.freeze({
  overdue: "overdue",
  lost: "lost",
  damaged: "damaged",
  manual: "manual", // added by staff (e.g. a replacement card)
});

export const FINE_STATUSES = Object.freeze({
  outstanding: "outstanding", // something left to pay
  paid: "paid",
  waived: "waived", // nothing left to pay, at least partly waived
});

/** Our own record of a payment; the provider's raw response is never the source of truth. */
export const PAYMENT_STATUSES = Object.freeze({
  pending: "pending", // card checkout started, not yet confirmed by a verified webhook
  succeeded: "succeeded",
  failed: "failed",
  refunded: "refunded", // fully refunded
  partiallyRefunded: "partially_refunded",
});

export const PAYMENT_METHODS = Object.freeze({ cash: "cash", card: "card" });
