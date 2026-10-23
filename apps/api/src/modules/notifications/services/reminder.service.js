import { LOAN_POPULATE } from "../../circulation/repositories/loan.repository.js";
import { LOAN_STATUSES } from "../../circulation/constants/circulation-statuses.js";
import { MEMBER_STATUSES } from "../../members/models/member.model.js";
import { NOTIFICATION_TYPES } from "../../settings/constants/library-settings.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (date) => new Date(date).toISOString().slice(0, 10);

/**
 * Scheduled reminders (run by the worker). Each notification has a dedupe key,
 * so running a job twice, or on two workers, never notifies twice.
 */
export class ReminderService {
  #loans;
  #members;
  #settings;
  #notifications;

  constructor({ loanRepository, memberRepository, settingsService, notificationService }) {
    this.#loans = loanRepository;
    this.#members = memberRepository;
    this.#settings = settingsService;
    this.#notifications = notificationService;
  }

  /** Loans due within `dueSoonDays`: one reminder per loan and due date (a renewal earns a new one). */
  async dueSoon(now = new Date()) {
    const { notifications } = await this.#settings.get();
    const filter = { status: LOAN_STATUSES.active, dueAt: { $gte: now, $lte: new Date(now.getTime() + notifications.dueSoonDays * DAY_MS) } };
    return this.#eachLoan(filter, NOTIFICATION_TYPES.dueSoon, (loan) => `${loan._id}:${isoDate(loan.dueAt)}`);
  }

  /** Overdue loans: a notice on the first day, then one a week while it stays out. */
  async overdue(now = new Date()) {
    const filter = { status: LOAN_STATUSES.active, dueAt: { $lt: now } };
    return this.#eachLoan(filter, NOTIFICATION_TYPES.overdue, (loan) => {
      const week = Math.floor((now - new Date(loan.dueAt)) / (7 * DAY_MS));
      return `${loan._id}:${isoDate(loan.dueAt)}:w${week}`;
    });
  }

  /** Memberships expiring within `membershipExpiryDays`. */
  async membershipsExpiring(now = new Date()) {
    const { notifications } = await this.#settings.get();
    const filter = { status: MEMBER_STATUSES.active, expiresAt: { $gt: now, $lte: new Date(now.getTime() + notifications.membershipExpiryDays * DAY_MS) } };
    let count = 0;
    for await (const member of this.#members.cursor(filter, { populate: { path: "membershipType", select: "name" } })) {
      await this.#notifications.notifyMember(
        member,
        NOTIFICATION_TYPES.membershipExpiring,
        { expiresAt: isoDate(member.expiresAt), membershipType: member.membershipType?.name },
        `${member._id}:${isoDate(member.expiresAt)}`
      );
      count += 1;
    }
    return count;
  }

  async #eachLoan(filter, type, keyOf) {
    let count = 0;
    for await (const loan of this.#loans.cursor(filter, { populate: LOAN_POPULATE })) {
      const member = await this.#members.findById(loan.member._id);
      if (!member) continue;
      await this.#notifications.notifyMember(
        member,
        type,
        { title: loan.book?.bookTitle, barcode: loan.copy?.barcode, dueDate: isoDate(loan.dueAt) },
        keyOf(loan)
      );
      count += 1;
    }
    return count;
  }
}
