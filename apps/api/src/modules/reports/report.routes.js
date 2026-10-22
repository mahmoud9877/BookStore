import joi from "joi";
import { Router } from "express";
import { toCsv } from "./csv.js";
import { toOverdueRow } from "./report.service.js";
import { RequestDto, fields } from "../../core/dto.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { PERMISSIONS } from "../roles/permissions.js";

class ReportQueryDto extends RequestDto {
  static schema = joi.object({
    from: joi.date(),
    to: joi.date().min(joi.ref("from")),
    branch: fields.ref(),
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(500).default(20),
    order: joi.string().valid("most", "least").default("most"),
    format: joi.string().valid("json", "csv").default("json"),
  });
}

const sendCsv = (res, name, csv) =>
  res
    .set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"` })
    .send(csv);

const BOOK_COLUMNS = [
  { key: (row) => row.book?.bookTitle, label: "Title" },
  { key: (row) => row.book?.author, label: "Author" },
  { key: (row) => row.book?.isbn, label: "ISBN" },
];

/**
 * Each report: GET /reports/<name>?from=&to=&branch=&page=&limit=&format=csv.
 * `csv` is the CSV columns for the report's rows, or absent when it has no export.
 */
const REPORTS = {
  summary: { run: (s, q, a) => s.summary(q, a) },
  "top-titles": { run: (s, q, a) => s.topTitles(q, a), csv: [...BOOK_COLUMNS, { key: "loans", label: "Loans" }] },
  inventory: {
    run: (s, q, a) => s.inventory(q, a),
    csv: [
      { key: (row) => row.branch?.name, label: "Branch" },
      { key: "total", label: "Total" },
      ...["available", "on_loan", "on_hold", "in_transit", "damaged", "lost", "missing", "withdrawn"].map((status) => ({ key: (row) => row.statuses[status] ?? 0, label: status })),
    ],
  },
  fines: {
    run: (s, q, a) => s.fines(q, a),
    csv: [{ key: (row) => row.member?.memberNumber, label: "Member number" }, { key: (row) => row.member?.name, label: "Member" }, { key: "fines", label: "Fines" }, { key: "balance", label: "Balance (minor units)" }, { key: "oldest", label: "Oldest fine" }],
  },
  memberships: { run: (s, q, a) => s.memberships(q, a) },
  reservations: { run: (s, q, a) => s.reservations(q, a), csv: [...BOOK_COLUMNS, { key: "waiting", label: "Waiting" }, { key: "oldest", label: "Oldest reservation" }] },
  acquisitions: {
    run: (s, q, a) => s.acquisitions(q, a),
    csv: [{ key: (row) => row.supplier?.name, label: "Supplier" }, "orders", "orderedCopies", "receivedCopies", "orderedCost", "receivedCost"],
  },
  branches: {
    run: (s, q, a) => s.branches(q, a),
    csv: [{ key: (row) => row.branch.name, label: "Branch" }, "copies", "loans", "overdue", "activeMembers", "collected"],
  },
};

const OVERDUE_COLUMNS = ["title", "barcode", "memberNumber", "memberName", "email", "phone", "branch", "dueAt", "daysOverdue"];

export function createReportRouter({ reportService, authGuard }) {
  const router = Router();
  const canRead = authGuard.requirePermission(PERMISSIONS.ReportsRead);

  for (const [name, report] of Object.entries(REPORTS)) {
    router.get(
      `/${name}`,
      canRead,
      validate(ReportQueryDto),
      asyncHandler(async (req, res) => {
        const result = await report.run(reportService, req.dto, req.access);
        if (req.dto.format === "csv" && report.csv) {
          return sendCsv(res, name, toCsv(Array.isArray(result) ? result : result.data, report.csv));
        }
        return res.json(Array.isArray(result) || !("data" in result) ? { data: result } : result);
      })
    );
  }

  // Overdue loans can be long: the CSV is streamed from a cursor.
  router.get(
    "/overdue",
    canRead,
    validate(ReportQueryDto),
    asyncHandler(async (req, res) => {
      if (req.dto.format !== "csv") return res.json(await reportService.overdue(req.dto, req.access));
      res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="overdue-${new Date().toISOString().slice(0, 10)}.csv"` });
      res.write(toCsv([], OVERDUE_COLUMNS));
      for await (const loan of reportService.overdueCursor(req.dto, req.access)) {
        res.write(toCsv([toOverdueRow(loan)], OVERDUE_COLUMNS).split("\r\n").slice(1).join("\r\n"));
      }
      return res.end();
    })
  );

  router.get(
    "/staff-activity",
    authGuard.requirePermission(PERMISSIONS.AuditRead),
    validate(ReportQueryDto),
    asyncHandler(async (req, res) => {
      const rows = await reportService.staffActivity(req.dto, req.access);
      if (req.dto.format === "csv") return sendCsv(res, "staff-activity", toCsv(rows, ["actorName", "actions", "lastAt"]));
      return res.json({ data: rows });
    })
  );

  return router;
}
