import { branchModel, locationModel } from "../models/branch.model.js";
import { BaseRepository } from "../../../core/base-repository.js";

export class BranchRepository extends BaseRepository {
  constructor(model = branchModel) {
    super(model);
  }

  listActive() {
    return this.findMany({ isActive: true }, { sort: { name: 1 } });
  }
}

export class LocationRepository extends BaseRepository {
  constructor(model = locationModel) {
    super(model);
  }
}
