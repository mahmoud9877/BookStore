import { ConflictError, ensureFound } from "./http-errors.js";
import { escapeRegExp, pageOf, toSort } from "./pagination.js";

const DUPLICATE_KEY = 11000;

/**
 * List/get/create/update/delete for reference data (branches, suppliers,
 * authors, …) that has no workflow of its own. Subclasses set the static
 * configuration and override hooks where a rule applies (e.g. `beforeDelete`).
 * Writes are audited.
 */
export class CrudService {
  /** Name used in messages and audit entries, e.g. "Branch". */
  static entity = "Record";
  /** Fields matched by `?search=`. */
  static searchFields = ["name"];
  /** Response DTO class. */
  static Dto = null;

  repository;
  audit;

  constructor({ repository, auditService }) {
    this.repository = repository;
    this.audit = auditService;
  }

  get #config() {
    return this.constructor;
  }

  /** Extra filter applied to every list (e.g. branch scoping). */
  // eslint-disable-next-line no-unused-vars
  scopeFilter(actor) {
    return {};
  }

  async list({ page, limit, sort, search, ...filters }, actor) {
    const filter = { ...this.scopeFilter(actor) };
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") filter[key] = value;
    if (search) {
      const pattern = new RegExp(escapeRegExp(search), "i");
      filter.$or = this.#config.searchFields.map((field) => ({ [field]: pattern }));
    }
    const result = await this.repository.paginate(filter, { page, limit, sort: toSort(sort), populate: this.populate });
    return pageOf({ ...result, items: this.#config.Dto.fromList(result.items) }, { page, limit });
  }

  async get(id) {
    const record = await this.repository.findById(id, { populate: this.populate });
    return this.#config.Dto.from(ensureFound(record, `${this.#config.entity} not found`));
  }

  async create(data, actor) {
    await this.beforeWrite(data, null, actor);
    const record = await this.#translateDuplicate(() => this.repository.create(data));
    await this.audit.record(actor, { action: `${this.#auditName}.create`, entity: this.#config.entity, entityId: record._id, after: record, branch: record.branch });
    return this.get(record._id);
  }

  async update(id, data, actor) {
    const before = ensureFound(await this.repository.findById(id), `${this.#config.entity} not found`);
    await this.beforeWrite(data, before, actor);
    const record = await this.#translateDuplicate(() => this.repository.updateById(id, data));
    await this.audit.record(actor, { action: `${this.#auditName}.update`, entity: this.#config.entity, entityId: id, before, after: record, branch: record.branch });
    return this.get(id);
  }

  async remove(id, actor) {
    const before = ensureFound(await this.repository.findById(id), `${this.#config.entity} not found`);
    await this.beforeDelete(before, actor);
    await this.repository.deleteById(id);
    await this.audit.record(actor, { action: `${this.#auditName}.delete`, entity: this.#config.entity, entityId: id, before, branch: before.branch });
  }

  /** Hook: validate a create (`existing` null) or update. Throw an HttpError to reject. */
  async beforeWrite() {}

  /** Hook: refuse deleting records that are still referenced. */
  async beforeDelete() {}

  get #auditName() {
    return this.#config.entity.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  }

  async #translateDuplicate(write) {
    try {
      return await write();
    } catch (error) {
      if (error.code === DUPLICATE_KEY) {
        const field = Object.keys(error.keyPattern ?? {})[0] ?? "value";
        throw new ConflictError(`A ${this.#config.entity.toLowerCase()} with this ${field} already exists`);
      }
      throw error;
    }
  }
}
