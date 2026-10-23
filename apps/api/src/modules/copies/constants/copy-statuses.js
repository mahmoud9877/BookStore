// Values are persisted in copies.status; do not rename them.
export const COPY_STATUSES = Object.freeze({
  available: "available", // on the shelf, can be lent
  onLoan: "on_loan",
  onHold: "on_hold", // set aside for a ready reservation
  inTransit: "in_transit", // moving between branches
  damaged: "damaged",
  lost: "lost",
  missing: "missing", // not found during a stocktake
  withdrawn: "withdrawn", // permanently removed from circulation
});

const S = COPY_STATUSES;

/** Statuses changed only by circulation/transfer workflows, never by a manual adjustment. */
export const WORKFLOW_STATUSES = Object.freeze([S.onLoan, S.onHold, S.inTransit]);

/** Manual inventory adjustments allowed from each status (with a recorded reason). */
export const ADJUSTMENT_TRANSITIONS = Object.freeze({
  [S.available]: [S.damaged, S.lost, S.missing, S.withdrawn],
  [S.damaged]: [S.available, S.withdrawn, S.lost],
  [S.missing]: [S.available, S.lost, S.withdrawn],
  [S.lost]: [S.available, S.withdrawn], // found again
  [S.withdrawn]: [],
  [S.onLoan]: [],
  [S.onHold]: [],
  [S.inTransit]: [],
});

export const COPY_CONDITIONS = Object.freeze(["new", "good", "fair", "poor"]);

export const canAdjust = (from, to) => ADJUSTMENT_TRANSITIONS[from]?.includes(to) ?? false;
