import { PERMISSIONS as P } from "../auth/permissions.js";
import { msg } from "../../i18n/index.js";

/**
 * Dashboard sections, grouped for the sidebar. Labels are English keys:
 * translate them where they are rendered (t(label)). Each is shown to roles holding
 * any of its permissions — the same permissions its API endpoints require.
 */
export const ADMIN_GROUPS = [
  {
    label: msg("Circulation"),
    sections: [
      { path: "desk", label: msg("Circulation desk"), icon: "upc-scan", permissions: [P.CirculationManage] },
      { path: "loans", label: msg("Loans"), icon: "arrow-left-right", permissions: [P.CirculationManage, P.MembersRead] },
      { path: "reservations", label: msg("Reservations"), icon: "bookmark-star", permissions: [P.ReservationsManage, P.CirculationManage] },
      { path: "members", label: msg("Members"), icon: "person-vcard", permissions: [P.MembersRead, P.MembersManage] },
      { path: "fines", label: msg("Fines & payments"), icon: "cash-coin", permissions: [P.FinesManage, P.PaymentsManage] },
    ],
  },
  {
    label: msg("Catalogue"),
    sections: [
      { path: "books", label: msg("Books"), icon: "book", permissions: [P.BooksManage] },
      { path: "copies", label: msg("Copies"), icon: "upc", permissions: [P.CopiesManage, P.InventoryManage] },
      { path: "categories", label: msg("Categories"), icon: "tags", permissions: [P.CategoriesManage] },
      { path: "authors", label: msg("Authors & publishers"), icon: "people", permissions: [P.BooksManage] },
      { path: "digital", label: msg("Digital library"), icon: "file-earmark-pdf", permissions: [P.DigitalManage] },
    ],
  },
  {
    label: msg("Inventory"),
    sections: [
      { path: "transfers", label: msg("Transfers"), icon: "truck", permissions: [P.InventoryManage] },
      { path: "stocktakes", label: msg("Stocktakes"), icon: "clipboard-check", permissions: [P.InventoryManage] },
      { path: "acquisitions", label: msg("Acquisitions"), icon: "cart-check", permissions: [P.AcquisitionsManage] },
    ],
  },
  {
    label: msg("Shop"),
    sections: [
      { path: "coupons", label: msg("Coupons"), icon: "ticket-perforated", permissions: [P.OrdersManage] },
    ],
  },
  {
    label: msg("Library"),
    sections: [
      { path: "branches", label: msg("Branches & shelves"), icon: "building", permissions: [P.BranchesManage] },
      { path: "rooms", label: msg("Rooms & events"), icon: "calendar-event", permissions: [P.FacilitiesManage] },
    ],
  },
  {
    label: msg("Administration"),
    sections: [
      { path: "reports", label: msg("Reports"), icon: "bar-chart", permissions: [P.ReportsRead] },
      { path: "audit", label: msg("Audit log"), icon: "journal-text", permissions: [P.AuditRead] },
      { path: "users", label: msg("Users"), icon: "person-gear", permissions: [P.UsersRead, P.UsersManage] },
      { path: "roles", label: msg("Roles & permissions"), icon: "shield-lock", permissions: [P.RolesManage] },
      { path: "settings", label: msg("Settings"), icon: "sliders", permissions: [P.SettingsManage] },
    ],
  },
];

export const ADMIN_SECTIONS = ADMIN_GROUPS.flatMap((group) => group.sections);

/** Every permission that opens at least one section. */
export const ADMIN_PERMISSIONS = [...new Set(ADMIN_SECTIONS.flatMap((section) => section.permissions))];

export const sectionFor = (path) => ADMIN_SECTIONS.find((section) => section.path === path);
