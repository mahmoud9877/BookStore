import { CopyResponseDto } from "./copy.dto.js";
import { COPY_POPULATE } from "./copy.repository.js";
import { canAdjust } from "./copy-statuses.js";
import { escapeRegExp, pageOf, toSort } from "../../core/pagination.js";
import { BadRequestError, ConflictError, ensureFound } from "../../core/http-errors.js";

const COPY_NOT_FOUND = "Copy not found";

/** Physical copies: adding them to a branch, describing them, and manual status adjustments. */
export class CopyService {
  #copies;
  #books;
  #branches;
  #locations;
  #sequences;
  #transactions;
  #audit;

  constructor({ copyRepository, bookRepository, branchRepository, locationRepository, sequenceGenerator, transactionRunner, auditService }) {
    this.#copies = copyRepository;
    this.#books = bookRepository;
    this.#branches = branchRepository;
    this.#locations = locationRepository;
    this.#sequences = sequenceGenerator;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  /** Staff see the copies of their branches. */
  async list({ page, limit, sort, book, branch, status, search }, actor) {
    const filter = { ...actor.branchFilter("branch") };
    if (book) filter.book = book;
    if (branch) filter.branch = branch;
    if (status) filter.status = status;
    if (search) filter.barcode = new RegExp(`^${escapeRegExp(search.toUpperCase())}`);
    const result = await this.#copies.paginate(filter, { page, limit, sort: toSort(sort), populate: COPY_POPULATE });
    return pageOf({ ...result, items: CopyResponseDto.fromList(result.items) }, { page, limit });
  }

  async get(id) {
    return CopyResponseDto.from(ensureFound(await this.#copies.findById(id, { populate: COPY_POPULATE }), COPY_NOT_FOUND));
  }

  /** Scanner lookup: a barcode scanner types the barcode like a keyboard. */
  async getByBarcode(barcode) {
    return CopyResponseDto.from(ensureFound(await this.#copies.findByBarcode(barcode), COPY_NOT_FOUND));
  }

  /** @param {import("./copy.dto.js").CreateCopiesDto} dto */
  async addCopies({ book, branch, location, count, barcodes, condition, cost, notes }, actor, acquisition = {}) {
    actor.assertBranch(branch);
    ensureFound(await this.#books.findById(book), "Book not found");
    const branchRecord = ensureFound(await this.#branches.findById(branch), "Branch not found");
    if (location) await this.#assertLocationInBranch(location, branch);
    if (!(count >= 1)) throw new BadRequestError("Add at least one copy");
    if (barcodes?.length && barcodes.length !== count) {
      throw new BadRequestError(`Provide exactly ${count} barcode(s), or none to generate them`);
    }

    // Numbers are drawn outside the transaction: a gap after a failure is harmless,
    // while a shared counter inside concurrent transactions would conflict.
    const codes = barcodes?.length ? barcodes : await this.#generateBarcodes(branchRecord.code, count);

    return this.#transactions.run(async () => {
      const taken = await this.#copies.countWhere({ barcode: { $in: codes } });
      if (taken) throw new ConflictError("A copy with one of these barcodes already exists");

      const copies = await this.#copies.insertMany(
        codes.map((barcode) => ({
          book, branch, location: location ?? null, barcode, condition, cost: cost ?? null, notes,
          acquiredAt: new Date(), ...acquisition,
        }))
      );
      await this.#audit.record(actor, {
        action: "copy.add",
        entity: "Copy",
        entityId: copies[0]._id,
        branch,
        after: { book, barcodes: codes, ...acquisition },
      });
      return CopyResponseDto.fromList(copies);
    });
  }

  /** @param {import("./copy.dto.js").UpdateCopyDto} dto */
  async updateCopy({ id, ...changes }, actor) {
    const copy = ensureFound(await this.#copies.findById(id), COPY_NOT_FOUND);
    actor.assertBranch(copy.branch);
    if (changes.location) await this.#assertLocationInBranch(changes.location, copy.branch);
    const update = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    const updated = await this.#copies.updateById(id, update);
    await this.#audit.record(actor, { action: "copy.update", entity: "Copy", entityId: id, branch: copy.branch, before: copy, after: updated });
    return this.get(id);
  }

  /**
   * A manual inventory adjustment (damaged, lost, found, withdrawn, …) with a
   * reason, recorded in the audit log. Loans, holds and transfers change status
   * only through their own workflows.
   * @param {import("./copy.dto.js").AdjustCopyStatusDto} dto
   */
  async adjustStatus({ id, status, reason }, actor) {
    const copy = ensureFound(await this.#copies.findById(id), COPY_NOT_FOUND);
    actor.assertBranch(copy.branch);
    if (!canAdjust(copy.status, status)) {
      throw new BadRequestError(`A copy cannot be changed from ${copy.status} to ${status} by an adjustment`);
    }
    const updated = await this.#copies.transition(id, copy.status, status);
    if (!updated) throw new ConflictError("The copy changed while you were editing it. Reload and try again.");
    await this.#audit.record(actor, {
      action: "inventory.adjust",
      entity: "Copy",
      entityId: id,
      branch: copy.branch,
      before: { status: copy.status },
      after: { status },
      reason,
    });
    return this.get(id);
  }

  async #generateBarcodes(branchCode, count) {
    const codes = [];
    for (let index = 0; index < count; index += 1) codes.push(await this.#sequences.nextCode("copy", branchCode, 7));
    return codes;
  }

  async #assertLocationInBranch(locationId, branchId) {
    const location = await this.#locations.findById(locationId);
    if (!location || String(location.branch) !== String(branchId)) {
      throw new BadRequestError("The shelf must belong to the copy's branch");
    }
  }
}
