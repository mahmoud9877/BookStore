/** Query prefixes a money change touches. */
export const FINANCE_KEYS = [["fines"], ["payments"], ["members"], ["reports"]];

/** A key for one payment attempt: retries of the same submission never record twice. */
export const newIdempotencyKey = () =>
  window.crypto?.randomUUID?.() ?? `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
