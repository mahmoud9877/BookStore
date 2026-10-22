// Values are persisted in roles.permissions; do not rename them.
export const PERMISSIONS = Object.freeze({
  BooksManage: "books:manage",
  CategoriesManage: "categories:manage",
  CopiesManage: "copies:manage",
  CirculationManage: "circulation:manage",
  ReservationsManage: "reservations:manage",
  MembersRead: "members:read",
  MembersManage: "members:manage",
  InventoryManage: "inventory:manage",
  AcquisitionsManage: "acquisitions:manage",
  BranchesManage: "branches:manage",
  FinesManage: "fines:manage",
  PaymentsManage: "payments:manage",
  FacilitiesManage: "facilities:manage",
  DigitalManage: "digital:manage",
  OrdersManage: "orders:manage",
  ReportsRead: "reports:read",
  AuditRead: "audit:read",
  SettingsManage: "settings:manage",
  UsersRead: "users:read",
  UsersManage: "users:manage",
  RolesManage: "roles:manage",
});

const P = PERMISSIONS;

/** Every permission with a human-readable label, grouped and in display order. */
export const PERMISSION_CATALOGUE = Object.freeze([
  { key: P.BooksManage, group: "Catalogue", label: "Manage books", description: "Titles, editions, authors and publishers." },
  { key: P.CategoriesManage, group: "Catalogue", label: "Manage categories", description: "Create, rename and delete categories." },
  { key: P.CopiesManage, group: "Catalogue", label: "Manage copies", description: "Add physical copies, barcodes, shelves and condition." },
  { key: P.DigitalManage, group: "Catalogue", label: "Manage digital library", description: "Upload digital publications and set who may access them." },
  { key: P.CirculationManage, group: "Circulation", label: "Circulation desk", description: "Check out, return and renew loans; mark copies lost or damaged." },
  { key: P.ReservationsManage, group: "Circulation", label: "Manage reservations", description: "Place, cancel and fulfil reservations for members." },
  { key: P.MembersRead, group: "Members", label: "View members", description: "See member records, loans and balances." },
  { key: P.MembersManage, group: "Members", label: "Manage members", description: "Register, renew, suspend and edit members." },
  { key: P.FinesManage, group: "Finance", label: "Manage fines", description: "Add and waive fines." },
  { key: P.PaymentsManage, group: "Finance", label: "Manage payments", description: "Record payments and issue refunds." },
  { key: P.InventoryManage, group: "Inventory", label: "Manage inventory", description: "Adjustments, stocktakes and transfers between branches." },
  { key: P.AcquisitionsManage, group: "Inventory", label: "Manage acquisitions", description: "Suppliers, purchase orders and deliveries." },
  { key: P.BranchesManage, group: "Library", label: "Manage branches", description: "Branches, rooms and shelves." },
  { key: P.FacilitiesManage, group: "Library", label: "Manage rooms & events", description: "Bookable rooms, room bookings and events." },
  { key: P.OrdersManage, group: "Shop", label: "Manage orders", description: "Mark shop orders as delivered." },
  { key: P.ReportsRead, group: "Administration", label: "View reports", description: "Operational reports and exports." },
  { key: P.AuditRead, group: "Administration", label: "View audit log", description: "Who did what, and when." },
  { key: P.SettingsManage, group: "Administration", label: "Manage settings", description: "Borrowing, fine, reservation and notification policies; membership types." },
  { key: P.UsersRead, group: "Administration", label: "View users", description: "See every account." },
  { key: P.UsersManage, group: "Administration", label: "Manage users", description: "Change an account's role and branches." },
  { key: P.RolesManage, group: "Administration", label: "Manage roles", description: "Create, edit and delete roles and their permissions." },
]);

export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

/** Where a role's branch-specific permissions apply. */
export const BRANCH_SCOPES = Object.freeze({
  all: "all", // every branch
  assigned: "assigned", // only the branches assigned to the account (users.branches)
});

/**
 * Starting roles for a library, created once by a migration and editable afterwards.
 * They are suggestions, not policy: an administrator adjusts them to the library.
 */
export const DEFAULT_STAFF_ROLES = Object.freeze([
  {
    name: "Librarian",
    description: "Front desk: circulation, reservations, members and fines.",
    branchScope: BRANCH_SCOPES.assigned,
    permissions: [P.CirculationManage, P.ReservationsManage, P.MembersRead, P.MembersManage, P.FinesManage, P.CopiesManage],
  },
  {
    name: "Branch Manager",
    description: "Runs a branch: everything a librarian does plus inventory, rooms and reports.",
    branchScope: BRANCH_SCOPES.assigned,
    permissions: [
      P.CirculationManage, P.ReservationsManage, P.MembersRead, P.MembersManage, P.FinesManage,
      P.PaymentsManage, P.CopiesManage, P.InventoryManage, P.FacilitiesManage, P.ReportsRead, P.AuditRead,
    ],
  },
  {
    name: "Inventory Staff",
    description: "Copies, stocktakes, transfers and acquisitions.",
    branchScope: BRANCH_SCOPES.assigned,
    permissions: [P.BooksManage, P.CopiesManage, P.InventoryManage, P.AcquisitionsManage],
  },
  {
    name: "Finance Staff",
    description: "Fines, payments, refunds and financial reports.",
    branchScope: BRANCH_SCOPES.all,
    permissions: [P.MembersRead, P.FinesManage, P.PaymentsManage, P.ReportsRead],
  },
]);
