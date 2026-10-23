import { escapeRegExp } from "../../../core/pagination.js";
import { BaseRepository } from "../../../core/base-repository.js";
import { memberModel, membershipEventModel, membershipTypeModel } from "../models/member.model.js";

export const MEMBER_POPULATE = [
  { path: "membershipType", select: "code name loanLimit loanPeriodDays maxRenewals reservationLimit canAccessDigital" },
  { path: "homeBranch", select: "code name" },
];

export class MemberRepository extends BaseRepository {
  constructor(model = memberModel) {
    super(model);
  }

  findByUser(userId) {
    return this.findOne({ user: userId }, { populate: MEMBER_POPULATE });
  }

  findWithType(id) {
    return this.findById(id, { populate: MEMBER_POPULATE });
  }

  findByNumber(memberNumber) {
    return this.findOne({ memberNumber: memberNumber.trim().toUpperCase() }, { populate: MEMBER_POPULATE });
  }

  searchFilter(search) {
    const pattern = new RegExp(escapeRegExp(search), "i");
    return { $or: [{ name: pattern }, { email: pattern }, { memberNumber: pattern }, { phone: pattern }] };
  }
}

export class MembershipTypeRepository extends BaseRepository {
  constructor(model = membershipTypeModel) {
    super(model);
  }
}

export class MembershipEventRepository extends BaseRepository {
  constructor(model = membershipEventModel) {
    super(model);
  }

  listForMember(memberId) {
    return this.findMany({ member: memberId }, { sort: { createdAt: -1 }, limit: 100 });
  }
}
