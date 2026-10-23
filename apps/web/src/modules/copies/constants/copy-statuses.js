// Mirrors apps/api/src/modules/copies/copy-statuses.js.
export const COPY_STATUSES = ["available", "on_loan", "on_hold", "in_transit", "damaged", "lost", "missing", "withdrawn"];

export const COPY_CONDITIONS = ["new", "good", "fair", "poor"];

/** Manual adjustments allowed from each status; loans, holds and transfers change status only through their workflows. */
export const ADJUSTMENT_TRANSITIONS = {
  available: ["damaged", "lost", "missing", "withdrawn"],
  damaged: ["available", "withdrawn", "lost"],
  missing: ["available", "lost", "withdrawn"],
  lost: ["available", "withdrawn"],
  withdrawn: [],
  on_loan: [],
  on_hold: [],
  in_transit: [],
};
