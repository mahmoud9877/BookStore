import { msg, t } from "../../../i18n/index.js";

/*
 * Display text for roles. Only the built-in roles (Admin, User and the starting
 * staff roles from the API's DEFAULT_STAFF_ROLES) are translated; a role an
 * administrator created is shown exactly as typed, even if its name happens to
 * match some other UI text.
 */
const BUILT_IN_NAMES = {
  Admin: msg("Admin"),
  User: msg("User"),
  Librarian: msg("Librarian"),
  "Branch Manager": msg("Branch Manager"),
  "Inventory Staff": msg("Inventory Staff"),
  "Finance Staff": msg("Finance Staff"),
};

const BUILT_IN_DESCRIPTIONS = new Set([
  msg("Front desk: circulation, reservations, members and fines."),
  msg("Runs a branch: everything a librarian does plus inventory, rooms and reports."),
  msg("Copies, stocktakes, transfers and acquisitions."),
  msg("Fines, payments, refunds and financial reports."),
]);

export const roleName = (name) => (BUILT_IN_NAMES[name] ? t(BUILT_IN_NAMES[name]) : name);

/** An unedited starting description is translated; an edited one is shown as typed. */
export const roleDescription = (description) => (BUILT_IN_DESCRIPTIONS.has(description) ? t(description) : description);
