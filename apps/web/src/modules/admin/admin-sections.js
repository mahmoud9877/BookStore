import { PERMISSIONS as P } from "../auth/permissions.js";

/**
 * Dashboard sections, grouped for the sidebar. Each is shown to roles holding
 * any of its permissions — the same permissions its API endpoints require.
 */
export const ADMIN_GROUPS = [
  {
    label: "Circulation",
    sections: [
      { path: "desk", label: "Circulation desk", icon: "upc-scan", permissions: [P.CirculationManage] },
      { path: "loans", label: "Loans", icon: "arrow-left-right", permissions: [P.CirculationManage, P.MembersRead] },
      { path: "reservations", label: "Reservations", icon: "bookmark-star", permissions: [P.ReservationsManage, P.CirculationManage] },
      { path: "members", label: "Members", icon: "person-vcard", permissions: [P.MembersRead, P.MembersManage] },
      { path: "fines", label: "Fines & payments", icon: "cash-coin", permissions: [P.FinesManage, P.PaymentsManage] },
    ],
  },
  {
    label: "Catalogue",
    sections: [
      { path: "books", label: "Books", icon: "book", permissions: [P.BooksManage] },
      { path: "copies", label: "Copies", icon: "upc", permissions: [P.CopiesManage, P.InventoryManage] },
      { path: "categories", label: "Categories", icon: "tags", permissions: [P.CategoriesManage] },
      { path: "authors", label: "Authors & publishers", icon: "people", permissions: [P.BooksManage] },
      { path: "digital", label: "Digital library", icon: "file-earmark-pdf", permissions: [P.DigitalManage] },
    ],
  },
  {
    label: "Inventory",
    sections: [
      { path: "transfers", label: "Transfers", icon: "truck", permissions: [P.InventoryManage] },
      { path: "stocktakes", label: "Stocktakes", icon: "clipboard-check", permissions: [P.InventoryManage] },
      { path: "acquisitions", label: "Acquisitions", icon: "cart-check", permissions: [P.AcquisitionsManage] },
    ],
  },
  {
    label: "Library",
    sections: [
      { path: "branches", label: "Branches & shelves", icon: "building", permissions: [P.BranchesManage] },
      { path: "rooms", label: "Rooms & events", icon: "calendar-event", permissions: [P.FacilitiesManage] },
    ],
  },
  {
    label: "Administration",
    sections: [
      { path: "reports", label: "Reports", icon: "bar-chart", permissions: [P.ReportsRead] },
      { path: "audit", label: "Audit log", icon: "journal-text", permissions: [P.AuditRead] },
      { path: "users", label: "Users", icon: "person-gear", permissions: [P.UsersRead, P.UsersManage] },
      { path: "roles", label: "Roles & permissions", icon: "shield-lock", permissions: [P.RolesManage] },
      { path: "settings", label: "Settings", icon: "sliders", permissions: [P.SettingsManage] },
    ],
  },
];

export const ADMIN_SECTIONS = ADMIN_GROUPS.flatMap((group) => group.sections);

/** Every permission that opens at least one section. */
export const ADMIN_PERMISSIONS = [...new Set(ADMIN_SECTIONS.flatMap((section) => section.permissions))];

export const sectionFor = (path) => ADMIN_SECTIONS.find((section) => section.path === path);
