import { CrudService } from "../../core/crud-service.js";
import { BadRequestError, ConflictError } from "../../core/http-errors.js";
import { LOCATION_TYPES } from "./branch.model.js";
import { BranchResponseDto, LocationResponseDto } from "./branch.dto.js";

export class BranchService extends CrudService {
  static entity = "Branch";
  static searchFields = ["name", "code"];
  static Dto = BranchResponseDto;

  #copies;

  constructor({ branchRepository, copyRepository, auditService }) {
    super({ repository: branchRepository, auditService });
    this.#copies = copyRepository;
  }

  /** Every active branch (public: members choose a pickup branch). */
  async listActive() {
    return BranchResponseDto.fromList(await this.repository.listActive());
  }

  async beforeDelete(branch) {
    if (await this.#copies.countWhere({ branch: branch._id })) {
      throw new ConflictError("This branch still holds copies. Transfer them or deactivate the branch instead.");
    }
  }
}

/** Rooms and shelves. Staff manage only the locations of their branches. */
export class LocationService extends CrudService {
  static entity = "Location";
  static searchFields = ["code", "name"];
  static Dto = LocationResponseDto;

  #branches;
  #copies;

  constructor({ locationRepository, branchRepository, copyRepository, auditService }) {
    super({ repository: locationRepository, auditService });
    this.#branches = branchRepository;
    this.#copies = copyRepository;
  }

  scopeFilter(actor) {
    return actor.branchFilter("branch");
  }

  async get(id, actor) {
    const location = await super.get(id);
    actor?.assertBranch(location.branch);
    return location;
  }

  async beforeWrite(data, existing, actor) {
    const branch = data.branch ?? existing?.branch;
    actor.assertBranch(branch);
    if (existing) actor.assertBranch(existing.branch);
    if (data.branch && !(await this.#branches.findById(data.branch))) throw new BadRequestError("Unknown branch");
    const type = data.type ?? existing?.type;
    const parentId = data.parent === undefined ? existing?.parent : data.parent;
    if (type === LOCATION_TYPES.room && parentId) throw new BadRequestError("A room cannot be inside another location");
    if (parentId) {
      const parent = await this.repository.findById(parentId);
      if (!parent || parent.type !== LOCATION_TYPES.room || String(parent.branch) !== String(branch)) {
        throw new BadRequestError("A shelf's parent must be a room in the same branch");
      }
    }
  }

  async beforeDelete(location, actor) {
    actor.assertBranch(location.branch);
    const [copies, children] = await Promise.all([
      this.#copies.countWhere({ location: location._id }),
      this.repository.countWhere({ parent: location._id }),
    ]);
    if (copies || children) throw new ConflictError("This location still holds copies or shelves");
  }
}
