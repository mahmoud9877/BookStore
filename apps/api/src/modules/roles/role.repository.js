import { roleModel } from "./role.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class RoleRepository extends BaseRepository {
  constructor(model = roleModel) {
    super(model);
  }

  list() {
    return this.findMany({}, { sort: { name: 1 } });
  }

  /** Names of the custom roles that grant `permission`. */
  async namesGranting(permission) {
    const roles = await this.findMany({ permissions: permission }, { select: "name" });
    return roles.map((role) => role.name);
  }

  findByName(name) {
    return this.findOne({ name });
  }
}
