import React from "react";
import { formatDate, formatDateTime, formatMoney, humanize } from "../../lib/format.js";
import { msg, t } from "../../i18n/index.js";

const bookTitle = (row) => <span className="text-capitalize">{row.book?.bookTitle ?? t("Unknown title")}</span>;
const bookAuthor = (row) => <span className="text-capitalize">{row.book?.author}</span>;

/** A horizontal bar beside a number; the number stays visible for screen readers. */
export function Bar({ value, max, label }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="d-flex align-items-center gap-2">
      <div className="flex-grow-1 bg-light rounded" style={{ height: 8, minWidth: 60 }} aria-hidden="true">
        <div className="bg-primary rounded" style={{ width: `${width}%`, height: 8 }}></div>
      </div>
      <span className="text-nowrap tabular" style={{ minWidth: 40 }}>{label ?? value}</span>
    </div>
  );
}

const maxOf = (rows, key) => Math.max(0, ...rows.map((row) => row[key] ?? 0));

/**
 * Every report (labels and descriptions are English keys: render with t()): its API name, whether it pages and exports, its filters, and
 * how its rows render. `columns(rows)` receives the current rows (for bar scales).
 */
export const REPORTS = [
  { key: "summary", label: msg("Summary"), description: msg("Headline figures right now."), filters: ["branch"] },
  {
    key: "top-titles",
    label: msg("Top titles"),
    description: msg("Titles ranked by loans in the period. “Least borrowed” starts with titles never lent."),
    paged: true,
    csv: true,
    filters: ["range", "branch", "order"],
    columns: (rows) => [
      { key: "title", header: t("Title"), render: bookTitle },
      { key: "author", header: t("Author"), render: bookAuthor, hideBelow: "md" },
      { key: "loans", header: t("Loans"), render: (row) => <Bar value={row.loans} max={maxOf(rows, "loans")} /> },
    ],
  },
  {
    key: "inventory",
    label: msg("Inventory"),
    description: msg("Copies per branch and status: what is on the shelf, out, or unavailable."),
    csv: true,
    filters: ["branch"],
    columns: () => [
      { key: "branch", header: t("Branch"), render: (row) => row.branch?.name },
      { key: "total", header: t("Total") },
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
    label: msg("Overdue loans"),
    description: msg("Items past their due date, most overdue first."),
    paged: true,
    csv: true,
    filters: ["branch"],
    columns: () => [
      { key: "title", header: t("Title"), render: (row) => <span className="text-capitalize">{row.title}</span> },
      { key: "barcode", header: t("Copy"), hideBelow: "md" },
      { key: "member", header: t("Member"), render: (row) => `${row.memberName ?? ""} (${row.memberNumber ?? ""})` },
      { key: "branch", header: t("Branch"), hideBelow: "lg" },
      { key: "dueAt", header: t("Due"), render: (row) => formatDate(row.dueAt) },
      { key: "daysOverdue", header: t("Days late") },
    ],
  },
  {
    key: "fines",
    label: msg("Fines & collections"),
    description: msg("Outstanding balances by member, and fines issued and money collected in the period."),
    paged: true,
    csv: true,
    filters: ["range", "branch"],
    columns: (rows) => [
      { key: "member", header: t("Member"), render: (row) => `${row.member?.name ?? ""} (${row.member?.memberNumber ?? ""})` },
      { key: "fines", header: t("Fines") },
      { key: "balance", header: t("Balance"), render: (row) => <Bar value={row.balance} max={maxOf(rows, "balance")} label={formatMoney(row.balance)} /> },
      { key: "oldest", header: t("Oldest"), render: (row) => formatDate(row.oldest), hideBelow: "md" },
    ],
  },
  { key: "memberships", label: msg("Memberships"), description: msg("Members by status and membership type; joins in the period."), filters: ["range", "branch"] },
  {
    key: "reservations",
    label: msg("Reservations"),
    description: msg("Waiting queues per title, and how reservations ended in the period."),
    paged: true,
    csv: true,
    filters: ["range", "branch"],
    columns: (rows) => [
      { key: "title", header: t("Title"), render: bookTitle },
      { key: "waiting", header: t("Waiting"), render: (row) => <Bar value={row.waiting} max={maxOf(rows, "waiting")} /> },
      { key: "oldest", header: t("Waiting since"), render: (row) => formatDate(row.oldest), hideBelow: "md" },
    ],
  },
  {
    key: "acquisitions",
    label: msg("Acquisitions"),
    description: msg("Ordered and received copies and costs per supplier in the period."),
    csv: true,
    filters: ["range", "branch"],
    columns: (rows) => [
      { key: "supplier", header: t("Supplier"), render: (row) => row.supplier?.name ?? t("No supplier") },
      { key: "orders", header: t("Orders") },
      { key: "copies", header: t("Copies received"), render: (row) => `${row.receivedCopies} / ${row.orderedCopies}` },
      { key: "orderedCost", header: t("Ordered"), render: (row) => <Bar value={row.orderedCost} max={maxOf(rows, "orderedCost")} label={formatMoney(row.orderedCost)} /> },
      { key: "receivedCost", header: t("Received"), render: (row) => formatMoney(row.receivedCost), hideBelow: "md" },
    ],
  },
  {
    key: "branches",
    label: msg("Branch comparison"),
    description: msg("Copies, loans in the period, overdue items, active members and money collected per branch."),
    csv: true,
    filters: ["range"],
    columns: (rows) => [
      { key: "branch", header: t("Branch"), render: (row) => row.branch.name },
      { key: "copies", header: t("Copies"), hideBelow: "md" },
      { key: "loans", header: t("Loans"), render: (row) => <Bar value={row.loans} max={maxOf(rows, "loans")} /> },
      { key: "overdue", header: t("Overdue") },
      { key: "activeMembers", header: t("Active members"), hideBelow: "md" },
      { key: "collected", header: t("Collected"), render: (row) => formatMoney(row.collected) },
    ],
  },
  {
    key: "staff-activity",
    label: msg("Staff activity"),
    description: msg("Recorded actions per staff member in the period (from the audit log)."),
    csv: true,
    needsAudit: true,
    filters: ["range", "branch"],
    columns: (rows) => [
      { key: "actorName", header: t("Staff member") },
      { key: "actions", header: t("Actions"), render: (row) => <Bar value={row.actions} max={maxOf(rows, "actions")} /> },
      { key: "lastAt", header: t("Last action"), render: (row) => formatDateTime(row.lastAt), hideBelow: "md" },
    ],
  },
];
