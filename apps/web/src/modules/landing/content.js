import { msg } from "../../i18n/index.js";

/**
 * Landing page copy (English keys; translated where rendered with t()). Every feature listed here is implemented in this code base
 * (see docs/api.md); nothing claims customers, numbers or certifications.
 */
export const FEATURES = [
  { icon: "book", title: msg("Catalogue"), text: msg("Editions with validated ISBNs, authors, publishers, subjects and categories. Full-text search with filters and live availability per branch.") },
  { icon: "upc-scan", title: msg("Circulation desk"), text: msg("Check out and return by barcode, renew, record damage or loss. Loan limits and periods come from each membership type.") },
  { icon: "bookmark-star", title: msg("Reservations"), text: msg("Queues per title with holds at the member's pickup branch, automatic hand-over of returned copies and pickup deadlines.") },
  { icon: "person-vcard", title: msg("Members"), text: msg("Individuals, students, researchers and institutions. Registration, renewal, suspension and a full membership history.") },
  { icon: "clipboard-check", title: msg("Inventory & acquisitions"), text: msg("Copies with barcodes, shelves and condition. Stocktakes, audited adjustments, suppliers, purchase orders and deliveries.") },
  { icon: "building", title: msg("Multiple branches"), text: msg("Branches, rooms and shelves, transfers with history, and staff whose access is limited to their own branches.") },
  { icon: "cash-coin", title: msg("Fines & payments"), text: msg("Fines from your own policy, cash payments with receipts, refunds and waivers. Optional online card payments.") },
  { icon: "bar-chart", title: msg("Reports"), text: msg("Most and least borrowed titles, overdue loans, fines, memberships, reservations, acquisitions and branch comparisons, with CSV export.") },
  { icon: "bell", title: msg("Notifications"), text: msg("Due-soon and overdue reminders, reservation and membership notices — in the member's inbox and by email, never sent twice.") },
  { icon: "file-earmark-text", title: msg("Digital library"), text: msg("Publications in private storage, opened only by members whose membership and the item's licence allow it.") },
  { icon: "calendar-event", title: msg("Rooms & events"), text: msg("Bookable study rooms without double bookings, and events with registration up to capacity.") },
  { icon: "shield-lock", title: msg("Roles & audit log"), text: msg("Granular permissions per role, branch scope, and a record of every sensitive change: who, what, when and why.") },
];

export const BENEFITS = [
  { icon: "lightning-charge", title: msg("A faster desk"), text: msg("Scan a card and a barcode; the system applies the member's limits, holds and fines, so staff don't have to.") },
  { icon: "exclamation-diamond", title: msg("Overdue loans in plain sight"), text: msg("Overdue counts on the dashboard, an overdue report you can export, and reminders that go out on their own.") },
  { icon: "diagram-3", title: msg("One system for every branch"), text: msg("Availability per branch, transfers between them and pickup anywhere — without separate spreadsheets.") },
  { icon: "archive", title: msg("Inventory you can trust"), text: msg("Every copy has a status, and every change has a reason in the audit log. Stocktakes reconcile the shelves with the records.") },
  { icon: "graph-up", title: msg("Reports that answer real questions"), text: msg("What circulates, what doesn't, what is owed and what was bought — filtered by period and branch.") },
  { icon: "person-check", title: msg("Less manual work"), text: msg("Members renew, reserve, pay and book rooms themselves; the system notifies them when something needs their attention.") },
];

export const STEPS = [
  { title: msg("Set up your library"), text: msg("Create branches, rooms and shelves, define membership types and your borrowing, fine and reservation policies.") },
  { title: msg("Add books and members"), text: msg("Catalogue editions, add copies with barcodes or receive them from purchase orders, and register members.") },
  { title: msg("Run the desk"), text: msg("Lend, return, renew and manage reservations. Members follow their loans and holds in their own portal.") },
  { title: msg("Review and improve"), text: msg("Watch overdue loans and fines, compare branches, export reports and check the audit log.") },
];

export const AUDIENCES = [
  { icon: "buildings", title: msg("Public libraries"), text: msg("Open catalogue, member self-service, reservations with branch pickup, events and room bookings.") },
  { icon: "mortarboard", title: msg("School & university libraries"), text: msg("Student and researcher membership types with their own limits, plus a digital library restricted to members.") },
  { icon: "house-door", title: msg("Private & special libraries"), text: msg("A single branch works just as well, and staff roles can be limited to the modules you actually use.") },
  { icon: "diagram-2", title: msg("Multi-branch organizations"), text: msg("Branch-scoped staff roles, transfers, cross-branch pickup and side-by-side branch reports.") },
];
