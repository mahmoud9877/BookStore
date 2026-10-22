import { loanModel } from "./loan.model.js";
import { LOAN_STATUSES } from "./circulation-statuses.js";
import { BaseRepository } from "../../core/base-repository.js";

export const LOAN_POPULATE = [
  { path: "book", select: "bookTitle author isbn image" },
  { path: "copy", select: "barcode branch" },
  { path: "member", select: "memberNumber name email" },
  { path: "branch", select: "code name" },
  { path: "returnBranch", select: "code name" },
];

export class LoanRepository extends BaseRepository {
  constructor(model = loanModel) {
    super(model);
  }

  findActiveByCopy(copyId) {
    return this.findOne({ copy: copyId, status: LOAN_STATUSES.active });
  }

  countActive(memberId) {
    return this.countWhere({ member: memberId, status: LOAN_STATUSES.active });
  }

  /** Closes an active loan; resolves null if it was already closed (by a concurrent request). */
  close(loanId, status, fields) {
    return this.updateWhere({ _id: loanId, status: LOAN_STATUSES.active }, { $set: { status, ...fields } });
  }

  /** Renews only if nobody renewed it in the meantime (`renewals` unchanged). */
  renew(loanId, expectedRenewals, dueAt) {
    return this.updateWhere(
      { _id: loanId, status: LOAN_STATUSES.active, renewals: expectedRenewals },
      { $set: { dueAt }, $inc: { renewals: 1 } }
    );
  }
}
