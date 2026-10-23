// Values are persisted; do not rename them.
export const LOAN_STATUSES = Object.freeze({
  active: "active",
  returned: "returned",
  lost: "lost", // declared lost while on loan; closed
});

export const RESERVATION_STATUSES = Object.freeze({
  waiting: "waiting", // in the queue for the next copy
  inTransit: "in_transit", // a copy is on its way to the pickup branch
  ready: "ready", // a copy is held at the pickup branch until expiresAt
  fulfilled: "fulfilled", // the member borrowed it
  cancelled: "cancelled",
  expired: "expired", // not collected in time
});

const R = RESERVATION_STATUSES;

/** Reservations that still occupy a place in the queue (and count against limits). */
export const OPEN_RESERVATION_STATUSES = Object.freeze([R.waiting, R.inTransit, R.ready]);

/** Allowed reservation transitions; anything else is a bug or a race and is refused. */
export const RESERVATION_TRANSITIONS = Object.freeze({
  [R.waiting]: [R.inTransit, R.ready, R.fulfilled, R.cancelled],
  [R.inTransit]: [R.ready, R.cancelled],
  [R.ready]: [R.fulfilled, R.cancelled, R.expired],
  [R.fulfilled]: [],
  [R.cancelled]: [],
  [R.expired]: [],
});
