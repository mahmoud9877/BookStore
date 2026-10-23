import userModel from "../models/user.model.js";
import { escapeRegExp } from "../../../core/pagination.js";
import { BaseRepository } from "../../../core/base-repository.js";

const AUTH_PROJECTION = "userName email image role branches isActive confirmEmail";
const WITHOUT_SECRETS = "-password -code";

export class UserRepository extends BaseRepository {
  constructor(model = userModel) {
    super(model);
  }

  /** Projection used to authenticate requests (no password). */
  findAuthUserById(id) {
    return this.findById(id, { select: AUTH_PROJECTION });
  }

  findByEmail(email) {
    return this.findOne({ email });
  }

  /** Matches any of the given spellings (accounts may predate lowercase emails). */
  findByAnyEmail(emails) {
    return this.findOne({ email: { $in: emails } });
  }

  findByPhone(phone) {
    return this.findOne({ phone });
  }

  markEmailConfirmed(email) {
    return this.updateWhere({ email }, { confirmEmail: true });
  }

  /** One page of accounts, optionally matching `search` (name or email). */
  listWithoutSecrets({ page = 1, limit = 50, search, role } = {}) {
    const filter = {};
    if (search) {
      const pattern = new RegExp(escapeRegExp(search), "i");
      filter.$or = [{ userName: pattern }, { email: pattern }];
    }
    if (role) filter.role = role;
    return this.paginate(filter, { page, limit, sort: { createdAt: -1, _id: -1 }, select: WITHOUT_SECRETS });
  }

  updateAccess(id, update) {
    return this.updateWhere({ _id: id }, update, { select: WITHOUT_SECRETS });
  }

  findByIdWithoutSecrets(id) {
    return this.findById(id, { select: WITHOUT_SECRETS });
  }

  updateRole(id, role) {
    return this.updateWhere({ _id: id }, { role }, { select: WITHOUT_SECRETS });
  }

  /**
   * Ids of the active accounts holding any of `roles` (names; a RegExp also
   * matches, e.g. for case-insensitive built-in role names).
   */
  async findActiveIdsByRoles(roles) {
    if (!roles.length) return [];
    const users = await this.findMany({ role: { $in: roles }, isActive: { $ne: false } }, { select: "_id" });
    return users.map((user) => user._id);
  }

  /** Resolves `{ [roleName]: numberOfAccounts }`. */
  async countByRole() {
    const groups = await this.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]);
    return Object.fromEntries(groups.map(({ _id, count }) => [_id, count]));
  }
}
