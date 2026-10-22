import { ForbiddenError } from "../../core/http-errors.js";
import { MEMBER_STATUSES } from "./member.model.js";

/** Rules about what a member may do right now. Pure functions: easy to test. */
export const MemberPolicy = {
  isExpired(member, now = new Date()) {
    return new Date(member.expiresAt) <= now;
  },

  /** Why the member cannot borrow or reserve, or null when they can. */
  blockReason(member, now = new Date()) {
    if (member.status === MEMBER_STATUSES.suspended) {
      return `Membership suspended${member.statusReason ? `: ${member.statusReason}` : ""}`;
    }
    if (member.status === MEMBER_STATUSES.cancelled) return "Membership cancelled";
    if (this.isExpired(member, now)) return "Membership expired";
    return null;
  },

  assertInGoodStanding(member, now = new Date()) {
    const reason = this.blockReason(member, now);
    if (reason) throw new ForbiddenError(reason);
  },
};

/** Adds whole months, clamping to the last day of shorter months (Jan 31 + 1 = Feb 28/29). */
export function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
