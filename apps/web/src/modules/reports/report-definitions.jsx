import React from "react";
import { formatDate, formatDateTime, formatMoney, humanize } from "../../lib/format.js";

const bookTitle = (row) => <span className="text-capitalize">{row.book?.bookTitle ?? "Unknown title"}</span>;
const bookAuthor = (row) => <span className="text-capitalize">{row.book?.author}</span>;

/** A horizontal bar beside a number; the number stays visible for screen readers. */
export function Bar({ value, max, label }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="d-flex align-items-center gap-2">
      <div className="flex-grow-1 bg-light rounded" style={{ height: 8, minWidth: 60 }} aria-hidden="true">
        <div className="bg-primary rounded" style={{ width: `${width}%`, height: 8 }}></div>
      </div>
      <span className="text-nowrap" style={{ minWidth: 40 }}>{label ?? value}</span>
    </div>
  );
}

const maxOf = (rows, key) => Math.max(0, ...rows.map((row) => row[key] ?? 0));

/**
 * Every report: its API name, whether it pages and exports, its filters, and
 * how its rows render. `columns(rows)` receives the current rows (for bar scales).
 */
export const REPORTS = [
  { key: "summary", label: "Summary", description: "Headline figures right now.", filters: ["branch"] },
  {
    key: "top-titles",
    label: "Top titles",
    description: "Titles ranked by loans in the period. “Least borrowed” starts with titles never lent.",
    paged: true,
    csv: true,
    filters: ["range", "branch", "order"],
    columns: (rows) => [
      { key: "title", header: "Title", render: bookTitle },
      { key: "author", header: "Author", render: bookAuthor, hideBelow: "md" },
      { key: "loans", header: "Loans", render: (row) => <Bar value={row.loans} max={maxOf(rows, "loans")} /> },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Copies per branch and status: what is on the shelf, out, or unavailable.",
    csv: true,
    filters: ["branch"],
    columns: () => [
      { key: "branch", header: "Branch", render: (row) => row.branch?.name },
      { key: "total", header: "Total" },
      ...["available", "on_loan", "on_hold", "in_transit", "damaged", "lost", "missing"].map((status) => ({
        key: status,
        header: humanize(status),
        render: (row) => row.statuses[status] ?? 0,
        hideBelow: ["available", "on_loan"].includes(status) ? undefined : "lg",
      })),
    ],
  },
  {
    key: "overdue",
    label: "Overdue loans",
    description: "Items past their due date, most overdue first.",
    paged: true,
    csv: true,
    filters: ["branch"],
    columns: () => [
      { key: "title", header: "Title", render: (row) => <span className="text-capitalize">{row.title}</span> },
      { key: "barcode", header: "Copy", hideBelow: "md" },
      { key: "member", header: "Member", render: (row) => `${row.memberName ?? ""} (${row.memberNumber ?? ""})` },
      { key: "branch", header: "Branch", hideBelow: "lg" },
      { key: "dueAt", header: "Due", render: (row) => formatDate(row.dueAt) },
      { key: "daysOverdue", header: "Days late" },
    ],
  },
  {
    key: "fines",
    label: "Fines & collections",
    description: "Outstanding balances by member, and fines issued and money collected in the period.",
    paged: true,
    csv: true,
    filters: ["range", "branch"],
    columns: (rows) => [
      { key: "member", header: "Member", render: (row) => `${row.member?.name ?? ""} (${row.member?.memberNumber ?? ""})` },
      { key: "fines", header: "Fines" },
      { key: "balance", header: "Balance", render: (row) => <Bar value={row.balance} max={maxOf(rows, "balance")} label={formatMoney(row.balance)} /> },
      { key: "oldest", header: "Oldest", render: (row) => formatDate(row.oldest), hideBelow: "md" },
    ],
  },
  { key: "memberships", label: "Memberships", description: "Members by status and membership type; joins in the period.", filters: ["range", "branch"] },
  {
    key: "reservations",
    label: "Reservations",
    description: "Waiting queues per title, and how reservations ended in the period.",
    paged: true,
    csv: true,
    filters: ["range", "branch"],
    columns: (rows) => [
      { key: "title", header: "Title", render: bookTitle },
      { key: "waiting", header: "Waiting", render: (row) => <Bar value={row.waiting} max={maxOf(rows, "waiting")} /> },
      { key: "oldest", header: "Waiting since", render: (row) => formatDate(row.oldest), hideBelow: "md" },
    ],
  },
  {
    key: "acquisitions",
    label: "Acquisitions",
    description: "Ordered and received copies and costs per supplier in the period.",
    csv: true,
    filters: ["range", "branch"],
    columns: (rows) => [
      { key: "supplier", header: "Supplier", render: (row) => row.supplier?.name ?? "No supplier" },
      { key: "orders", header: "Orders" },
      { key: "copies", header: "Copies received", render: (row) => `${row.receivedCopies} / ${row.orderedCopies}` },
      { key: "orderedCost", header: "Ordered", render: (row) => <Bar value={row.orderedCost} max={maxOf(rows, "orderedCost")} label={formatMoney(row.orderedCost)} /> },
      { key: "receivedCost", header: "Received", render: (row) => formatMoney(row.receivedCost), hideBelow: "md" },
    ],
  },
  {
    key: "branches",
    label: "Branch comparison",
    description: "Copies, loans in the period, overdue items, active members and money collected per branch.",
    csv: true,
    filters: ["range"],
    columns: (rows) => [
      { key: "branch", header: "Branch", render: (row) => row.branch.name },
      { key: "copies", header: "Copies", hideBelow: "md" },
      { key: "loans", header: "Loans", render: (row) => <Bar value={row.loans} max={maxOf(rows, "loans")} /> },
      { key: "overdue", header: "Overdue" },
      { key: "activeMembers", header: "Active members", hideBelow: "md" },
      { key: "collected", header: "Collected", render: (row) => formatMoney(row.collected) },
    ],
  },
  {
    key: "staff-activity",
    label: "Staff activity",
    description: "Recorded actions per staff member in the period (from the audit log).",
    csv: true,
    needsAudit: true,
    filters: ["range", "branch"],
    columns: (rows) => [
      { key: "actorName", header: "Staff member" },
      { key: "actions", header: "Actions", render: (row) => <Bar value={row.actions} max={maxOf(rows, "actions")} /> },
      { key: "lastAt", header: "Last action", render: (row) => formatDateTime(row.lastAt), hideBelow: "md" },
    ],
  },
];
