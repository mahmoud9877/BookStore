import { Types } from "mongoose";
import { COPY_STATUSES } from "../../copies/constants/copy-statuses.js";
import { LOAN_STATUSES, OPEN_RESERVATION_STATUSES, RESERVATION_STATUSES } from "../../circulation/constants/circulation-statuses.js";
import { FINE_STATUSES, PAYMENT_STATUSES } from "../../finance/constants/finance-statuses.js";
import { MEMBER_STATUSES } from "../../members/models/member.model.js";
import { PURCHASE_STATUSES } from "../../acquisitions/models/acquisition.model.js";
import { buildPageFacet } from "../../../core/mongo-pagination.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const oid = (id) => new Types.ObjectId(String(id));

/**
 * Operational reports, computed by MongoDB aggregations (never by loading whole
 * collections into memory). Staff limited to assigned branches only see those.
 * Every method takes `{ from, to, branch }` (all optional) and the actor.
 */
export class ReportService {
  #books;
  #copies;
  #loans;
  #members;
  #reservations;
  #fines;
  #payments;
  #orders;
  #branches;
  #audit;

  constructor({ bookRepository, copyRepository, loanRepository, memberRepository, reservationRepository, fineRepository, paymentRepository, purchaseOrderRepository, branchRepository, auditLogRepository }) {
    this.#books = bookRepository;
    this.#copies = copyRepository;
    this.#loans = loanRepository;
    this.#members = memberRepository;
    this.#reservations = reservationRepository;
    this.#fines = fineRepository;
    this.#payments = paymentRepository;
    this.#orders = purchaseOrderRepository;
    this.#branches = branchRepository;
    this.#audit = auditLogRepository;
  }

  /** Branch restriction for `field`: the requested branch (if allowed) and the actor's scope. */
  #branchMatch(actor, field, branch) {
    if (branch) {
      actor.assertBranch(branch);
      return { [field]: oid(branch) };
    }
    return actor.allBranches ? {} : { [field]: { $in: actor.branchIds.map(oid) } };
  }

  #range(field, from, to) {
    if (!from && !to) return {};
    return { [field]: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } };
  }

  /** Headline numbers for the dashboard. */
  async summary({ branch }, actor) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [copies, activeLoans, overdueLoans, members, openReservations, finesOwed, collected, titles] = await Promise.all([
      this.#copies.aggregate([{ $match: this.#branchMatch(actor, "branch", branch) }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      this.#loans.countWhere({ ...this.#branchMatch(actor, "branch", branch), status: LOAN_STATUSES.active }),
      this.#loans.countWhere({ ...this.#branchMatch(actor, "branch", branch), status: LOAN_STATUSES.active, dueAt: { $lt: now } }),
      this.#members.aggregate([
        { $match: this.#branchMatch(actor, "homeBranch", branch) },
        { $group: { _id: { status: "$status", expired: { $lte: ["$expiresAt", now] } }, count: { $sum: 1 } } },
      ]),
      this.#reservations.countWhere({ ...this.#branchMatch(actor, "pickupBranch", branch), status: { $in: OPEN_RESERVATION_STATUSES } }),
      this.#sum(this.#fines, { ...this.#branchMatch(actor, "branch", branch), status: FINE_STATUSES.outstanding }, { $subtract: ["$amount", { $add: ["$paid", "$waived"] }] }),
      this.#sum(this.#payments, { ...this.#branchMatch(actor, "branch", branch), status: { $in: [PAYMENT_STATUSES.succeeded, PAYMENT_STATUSES.partiallyRefunded] }, paidAt: { $gte: monthStart } }, { $subtract: ["$amount", "$refundedAmount"] }),
      this.#books.countWhere({}),
    ]);
    const memberCounts = { active: 0, expired: 0, suspended: 0, cancelled: 0 };
    for (const { _id, count } of members) {
      if (_id.status === MEMBER_STATUSES.active) memberCounts[_id.expired ? "expired" : "active"] += count;
      else memberCounts[_id.status] = (memberCounts[_id.status] ?? 0) + count;
    }
    return {
      titles,
      copies: Object.fromEntries(copies.map(({ _id, count }) => [_id, count])),
      activeLoans,
      overdueLoans,
      members: memberCounts,
      openReservations,
      outstandingFines: finesOwed,
      collectedThisMonth: collected,
    };
  }

  /**
   * Titles ranked by loans in the period. `order: "least"` starts with titles
   * that were never borrowed (only titles with copies are considered).
   */
  async topTitles({ from, to, branch, order = "most", page = 1, limit = 20 }, actor) {
    const loanMatch = { ...this.#branchMatch(actor, "branch", branch), ...this.#range("checkedOutAt", from, to) };
    if (order === "most") {
      const rows = await this.#loans.aggregate([
        { $match: loanMatch },
        { $group: { _id: "$book", loans: { $sum: 1 } } },
        { $sort: { loans: -1, _id: 1 } },
        buildPageFacet(page, limit),
      ]);
      return this.#withBooks(rows[0], page, limit);
    }
    const copyMatch = this.#branchMatch(actor, "branch", branch);
    const rows = await this.#copies.aggregate([
      { $match: { ...copyMatch, status: { $ne: COPY_STATUSES.withdrawn } } },
      { $group: { _id: "$book" } },
      {
        $lookup: {
          from: "loans",
          let: { book: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$book", "$$book"] }, ...loanMatch } }, { $count: "n" }],
          as: "counted",
        },
      },
      { $project: { loans: { $ifNull: [{ $first: "$counted.n" }, 0] } } },
      { $sort: { loans: 1, _id: 1 } },
      buildPageFacet(page, limit),
    ]);
    return this.#withBooks(rows[0], page, limit);
  }

  /** Copies per branch and status, with totals: availability across the library. */
  async inventory({ branch }, actor) {
    const rows = await this.#copies.countsByBranchAndStatus(this.#branchMatch(actor, "branch", branch));
    const branches = await this.#branchNames(rows.map((row) => row.branch));
    const byBranch = {};
    for (const { branch: branchId, status, count } of rows) {
      const entry = (byBranch[branchId] ??= { branch: branches[branchId] ?? { _id: branchId }, total: 0, statuses: {} });
      entry.statuses[status] = count;
      entry.total += count;
    }
    return Object.values(byBranch).sort((a, b) => String(a.branch.name).localeCompare(String(b.branch.name)));
  }

  /** Active loans past due, most overdue first (paginated; use `overdueCursor` for exports). */
  async overdue({ branch, page = 1, limit = 50 }, actor) {
    const filter = this.#overdueFilter(actor, branch);
    const { items, total } = await this.#loans.paginate(filter, { page, limit, sort: { dueAt: 1, _id: 1 }, populate: OVERDUE_POPULATE });
    return { data: items.map(toOverdueRow), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  overdueCursor({ branch }, actor) {
    return this.#loans.cursor(this.#overdueFilter(actor, branch), { sort: { dueAt: 1 }, populate: OVERDUE_POPULATE });
  }

  /** Outstanding balances per member, plus fines issued and money collected in the period. */
  async fines({ from, to, branch, page = 1, limit = 50 }, actor) {
    const scope = this.#branchMatch(actor, "branch", branch);
    const [balances, issued, collected, refunded] = await Promise.all([
      this.#fines.aggregate([
        { $match: { ...scope, status: FINE_STATUSES.outstanding } },
        { $group: { _id: "$member", balance: { $sum: { $subtract: ["$amount", { $add: ["$paid", "$waived"] }] } }, fines: { $sum: 1 }, oldest: { $min: "$createdAt" } } },
        { $sort: { balance: -1, _id: 1 } },
        buildPageFacet(page, limit, {
          itemStages: [
            { $lookup: { from: "members", localField: "_id", foreignField: "_id", as: "member", pipeline: [{ $project: { memberNumber: 1, name: 1 } }] } },
            { $set: { member: { $first: "$member" } } },
          ],
          extraFacets: { sum: [{ $group: { _id: null, total: { $sum: "$balance" } } }] },
        }),
      ]),
      this.#fines.aggregate([{ $match: { ...scope, ...this.#range("createdAt", from, to) } }, { $group: { _id: "$type", amount: { $sum: "$amount" }, waived: { $sum: "$waived" }, count: { $sum: 1 } } }]),
      this.#sum(this.#payments, { ...scope, ...this.#range("paidAt", from, to), status: { $in: [PAYMENT_STATUSES.succeeded, PAYMENT_STATUSES.partiallyRefunded, PAYMENT_STATUSES.refunded] } }, "$amount"),
      this.#sum(this.#payments, { ...scope, ...this.#range("paidAt", from, to) }, "$refundedAmount"),
    ]);
    const [facet] = balances;
    return {
      data: facet.items.map(({ _id, ...row }) => row),
      meta: { page, limit, total: facet.total[0]?.n ?? 0, pages: Math.ceil((facet.total[0]?.n ?? 0) / limit) },
      totals: { outstanding: facet.sum[0]?.total ?? 0, collected, refunded, issuedByType: issued.map(({ _id, ...row }) => ({ type: _id, ...row })) },
    };
  }

  /** Members by status and membership type; joins in the period. */
  async memberships({ from, to, branch }, actor) {
    const scope = this.#branchMatch(actor, "homeBranch", branch);
    const now = new Date();
    const [byType, joined, expiringSoon] = await Promise.all([
      this.#members.aggregate([
        { $match: scope },
        {
          $group: {
            _id: "$membershipType",
            active: { $sum: { $cond: [{ $and: [{ $eq: ["$status", MEMBER_STATUSES.active] }, { $gt: ["$expiresAt", now] }] }, 1, 0] } },
            expired: { $sum: { $cond: [{ $and: [{ $eq: ["$status", MEMBER_STATUSES.active] }, { $lte: ["$expiresAt", now] }] }, 1, 0] } },
            suspended: { $sum: { $cond: [{ $eq: ["$status", MEMBER_STATUSES.suspended] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ["$status", MEMBER_STATUSES.cancelled] }, 1, 0] } },
          },
        },
        { $lookup: { from: "membershiptypes", localField: "_id", foreignField: "_id", as: "type", pipeline: [{ $project: { code: 1, name: 1 } }] } },
        { $set: { type: { $first: "$type" } } },
        { $project: { _id: 0 } },
      ]),
      this.#members.countWhere({ ...scope, ...this.#range("joinedAt", from, to) }),
      this.#members.countWhere({ ...scope, status: MEMBER_STATUSES.active, expiresAt: { $gt: now, $lte: new Date(now.getTime() + 30 * DAY_MS) } }),
    ]);
    return { byType, joinedInPeriod: joined, expiringWithin30Days: expiringSoon };
  }

  /** Queue lengths per title and how reservations ended in the period. */
  async reservations({ from, to, branch, page = 1, limit = 20 }, actor) {
    const scope = this.#branchMatch(actor, "pickupBranch", branch);
    const [queues, outcomes, waitTimes] = await Promise.all([
      this.#reservations.aggregate([
        { $match: { ...scope, status: RESERVATION_STATUSES.waiting } },
        { $group: { _id: "$book", waiting: { $sum: 1 }, oldest: { $min: "$createdAt" } } },
        { $sort: { waiting: -1, oldest: 1 } },
        buildPageFacet(page, limit),
      ]),
      this.#reservations.aggregate([{ $match: { ...scope, ...this.#range("closedAt", from, to), status: { $nin: OPEN_RESERVATION_STATUSES } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      this.#reservations.aggregate([
        { $match: { ...scope, ...this.#range("readyAt", from, to), readyAt: { $ne: null } } },
        { $group: { _id: null, averageWaitHours: { $avg: { $divide: [{ $subtract: ["$readyAt", "$createdAt"] }, 3_600_000] } } } },
      ]),
    ]);
    const page1 = await this.#withBooks(queues[0], page, limit);
    return {
      ...page1,
      outcomes: Object.fromEntries(outcomes.map(({ _id, count }) => [_id, count])),
      averageWaitHours: waitTimes[0]?.averageWaitHours ?? null,
    };
  }

  /** Ordered and received value per supplier in the period. */
  async acquisitions({ from, to, branch }, actor) {
    const scope = this.#branchMatch(actor, "branch", branch);
    return this.#orders.aggregate([
      { $match: { ...scope, ...this.#range("orderedAt", from, to), status: { $nin: [PURCHASE_STATUSES.requested, PURCHASE_STATUSES.approved, PURCHASE_STATUSES.rejected] } } },
      { $unwind: "$lines" },
      {
        $group: {
          _id: "$supplier",
          orders: { $addToSet: "$_id" },
          orderedCopies: { $sum: "$lines.quantity" },
          receivedCopies: { $sum: "$lines.received" },
          orderedCost: { $sum: { $multiply: ["$lines.quantity", "$lines.unitCost"] } },
          receivedCost: { $sum: { $multiply: ["$lines.received", "$lines.unitCost"] } },
        },
      },
      { $lookup: { from: "suppliers", localField: "_id", foreignField: "_id", as: "supplier", pipeline: [{ $project: { name: 1 } }] } },
      { $project: { _id: 0, supplier: { $first: "$supplier" }, orders: { $size: "$orders" }, orderedCopies: 1, receivedCopies: 1, orderedCost: 1, receivedCost: 1 } },
      { $sort: { orderedCost: -1 } },
    ]);
  }

  /** Side-by-side figures per branch for the period. */
  async branches({ from, to }, actor) {
    const branchFilter = actor.allBranches ? { isActive: true } : { _id: { $in: actor.branchIds } };
    const branches = await this.#branches.findMany(branchFilter, { sort: { name: 1 } });
    const period = this.#range("checkedOutAt", from, to);
    const now = new Date();
    const group = async (repository, match, field, value = 1) => {
      const rows = await repository.aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: value } } }]);
      return Object.fromEntries(rows.map((row) => [String(row._id), row.n]));
    };
    const [copies, loans, overdue, members, collected] = await Promise.all([
      group(this.#copies, { status: { $ne: COPY_STATUSES.withdrawn } }, "branch"),
      group(this.#loans, period, "branch"),
      group(this.#loans, { status: LOAN_STATUSES.active, dueAt: { $lt: now } }, "branch"),
      group(this.#members, { status: MEMBER_STATUSES.active, expiresAt: { $gt: now } }, "homeBranch"),
      group(this.#payments, { ...this.#range("paidAt", from, to), status: { $in: [PAYMENT_STATUSES.succeeded, PAYMENT_STATUSES.partiallyRefunded] } }, "branch", { $subtract: ["$amount", "$refundedAmount"] }),
    ]);
    return branches.map((item) => {
      const id = String(item._id);
      return { branch: { _id: item._id, code: item.code, name: item.name }, copies: copies[id] ?? 0, loans: loans[id] ?? 0, overdue: overdue[id] ?? 0, activeMembers: members[id] ?? 0, collected: collected[id] ?? 0 };
    });
  }

  /** Actions per staff member in the period (from the audit log). */
  async staffActivity({ from, to, branch }, actor) {
    return this.#audit.activityByActor({ actor: { $ne: null }, ...this.#branchMatch(actor, "branch", branch), ...this.#range("createdAt", from, to) });
  }

  #overdueFilter(actor, branch) {
    return { ...this.#branchMatch(actor, "branch", branch), status: LOAN_STATUSES.active, dueAt: { $lt: new Date() } };
  }

  async #sum(repository, match, expression) {
    const [row] = await repository.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: expression } } }]);
    return row?.total ?? 0;
  }

  async #withBooks(facet, page, limit) {
    const ids = facet.items.map((item) => item._id);
    const books = await this.#books.findMany({ _id: { $in: ids } }, { select: "bookTitle author isbn" });
    const byId = Object.fromEntries(books.map((book) => [String(book._id), book]));
    const total = facet.total[0]?.n ?? 0;
    return {
      data: facet.items.map(({ _id, ...row }) => ({ book: byId[String(_id)] ?? { _id }, ...row })),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async #branchNames(ids) {
    const branches = await this.#branches.findMany({ _id: { $in: ids } }, { select: "code name" });
    return Object.fromEntries(branches.map((branch) => [String(branch._id), branch]));
  }
}

const OVERDUE_POPULATE = [
  { path: "book", select: "bookTitle author" },
  { path: "copy", select: "barcode" },
  { path: "member", select: "memberNumber name email phone" },
  { path: "branch", select: "code name" },
];

export const toOverdueRow = (loan) => ({
  loanId: loan._id,
  title: loan.book?.bookTitle,
  barcode: loan.copy?.barcode,
  memberNumber: loan.member?.memberNumber,
  memberName: loan.member?.name,
  email: loan.member?.email,
  phone: loan.member?.phone,
  branch: loan.branch?.code,
  dueAt: loan.dueAt,
  daysOverdue: Math.floor((Date.now() - new Date(loan.dueAt).getTime()) / DAY_MS),
});
