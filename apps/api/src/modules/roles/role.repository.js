import { roleModel } from "./role.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class RoleRepository extends BaseRepository {
  constructor(model = roleModel) {
    super(model);
  }

  list() {
    return this.findMany({}, { sort: { name: 1 } });
  }

  findByName(name) {
    return this.findOne({ name });
  }
}
