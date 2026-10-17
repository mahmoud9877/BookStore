import userModel from "./user.model.js";
import { BaseRepository } from "../../core/base-repository.js";

const AUTH_PROJECTION = "userName email image role";
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

  listWithoutSecrets() {
    return this.findMany({}, { select: WITHOUT_SECRETS });
  }
}
