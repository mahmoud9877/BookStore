import userModel from "./user.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class UserRepository extends BaseRepository {
  constructor(model = userModel) {
    super(model);
  }

  /** Projection used to authenticate requests (no password). */
  findAuthUserById(id) {
    return this.model.findById(id).select("userName email image role");
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
    return this.model.findOneAndUpdate({ email }, { confirmEmail: true });
  }

  listWithoutSecrets() {
    return this.model.find({}).select("-password -code");
  }
}
