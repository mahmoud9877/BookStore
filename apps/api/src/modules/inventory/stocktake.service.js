import joi from "joi";
import { BaseRepository } from "../../core/base-repository.js";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";
import { pageOf, paginationKeys, toSort } from "../../core/pagination.js";
import { BadRequestError, ConflictError, ensureFound } from "../../core/http-errors.js";
import { COPY_STATUSES } from "../copies/copy-statuses.js";
import { STOCKTAKE_STATUSES, stocktakeModel, stocktakeScanModel } from "./stocktake.model.js";

const S = COPY_STATUSES;
// Copies that should be on a shelf of the branch.
const SHELF_STATUSES = [S.available, S.damaged];

export class StocktakeRepository extends BaseRepository {
  constructor(model = stocktakeModel) {
    super(model);
  }
}

export class StocktakeScanRepository extends BaseRepository {
  constructor(model = stocktakeScanModel) {
    super(model);
  }
}

export class ListStocktakesDto extends RequestDto {
  static schema = joi.object({ ...paginationKeys(["createdAt"]), branch: fields.ref(), status: joi.string().valid(...Object.values(STOCKTAKE_STATUSES)) });
}
export class StartStocktakeDto extends RequestDto {
  static schema = joi.object({ branch: fields.objectId(), location: fields.ref(), notes: joi.string().trim().max(500).allow("") });
}
export class ScanDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), barcodes: joi.array().items(joi.string().trim().uppercase().max(40)).min(1).max(500).required() });
}
export class CloseStocktakeDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), apply: joi.boolean().default(true) });
}
export class StocktakeIdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}
export class StocktakeResponseDto extends ResponseDto {
  static fields = ["_id", "branch", "location", "status", "startedBy", "closedAt", "notes", "result", "progress", "createdAt"];
}

/**
 * Stocktaking: scan what is on the shelves, compare with the records, then
 * (optionally) reconcile — unfound copies become "missing", missing or lost
 * copies that were found become "available". Every change is audited.
 */
export class StocktakeService {
  #stocktakes;
  #scans;
  #copies;
  #transactions;
  #audit;

  constructor({ stocktakeRepository, stocktakeScanRepository, copyRepository, transactionRunner, auditService }) {
    this.#stocktakes = stocktakeRepository;
    this.#scans = stocktakeScanRepository;
    this.#copies = copyRepository;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  async list({ page, limit, sort, branch, status }, actor) {
    const filter = { ...actor.branchFilter("branch"), ...(branch && { branch }), ...(status && { status }) };
    const result = await this.#stocktakes.paginate(filter, { page, limit, sort: toSort(sort), populate: [{ path: "branch", select: "code name" }, { path: "location", select: "code name" }] });
    return pageOf({ ...result, items: StocktakeResponseDto.fromList(result.items) }, { page, limit });
  }

  async start({ branch, location, notes }, actor) {
    actor.assertBranch(branch);
    try {
      const stocktake = await this.#stocktakes.create({ branch, location: location ?? null, notes, startedBy: actor.userId });
      await this.#audit.record(actor, { action: "stocktake.start", entity: "Stocktake", entityId: stocktake._id, branch });
      return this.get(stocktake._id, actor);
    } catch (error) {
      if (error.code === 11000) throw new ConflictError("A stocktake is already open for this branch");
      throw error;
    }
  }

  /** Records scanned barcodes (repeat scans are ignored). Resolves the progress. */
  async scan({ id, barcodes }, actor) {
    const stocktake = await this.#open(id, actor);
    const copies = await this.#copies.findMany({ barcode: { $in: barcodes } }, { select: "barcode" });
    const byBarcode = new Map(copies.map((copy) => [copy.barcode, copy._id]));
    await this.#scans.bulkWrite(
      [...new Set(barcodes)].map((barcode) => ({
        updateOne: {
          filter: { stocktake: stocktake._id, barcode },
          update: { $setOnInsert: { stocktake: stocktake._id, barcode, copy: byBarcode.get(barcode) ?? null, createdAt: new Date() } },
          upsert: true,
        },
      }))
    );
    return this.get(id, actor);
  }

  /** Compares the scans with the records. */
  async get(id, actor) {
    const stocktake = ensureFound(await this.#stocktakes.findById(id, { populate: [{ path: "branch", select: "code name" }, { path: "location", select: "code name" }] }), "Stocktake not found");
    actor.assertBranch(stocktake.branch._id);
    const comparison = await this.#compare(stocktake);
    return StocktakeResponseDto.from({
      ...stocktake,
      progress: {
        expected: comparison.expected.length,
        scanned: comparison.scanned.length,
        missing: comparison.missing.map((copy) => copy.barcode).slice(0, 500),
        foundAgain: comparison.foundAgain.map((copy) => copy.barcode),
        unexpected: comparison.unexpected.slice(0, 500),
      },
    });
  }

  /** Closes the stocktake; with `apply`, reconciles copy statuses. */
  async close({ id, apply }, actor) {
    const stocktake = await this.#open(id, actor);
    const comparison = await this.#compare(stocktake);
    await this.#transactions.run(async () => {
      if (apply) {
        for (const copy of comparison.missing) {
          if (await this.#copies.transition(copy._id, SHELF_STATUSES, S.missing)) {
            await this.#audit.record(actor, { action: "inventory.adjust", entity: "Copy", entityId: copy._id, branch: stocktake.branch, before: { status: copy.status }, after: { status: S.missing }, reason: `Not found in stocktake ${id}` });
          }
        }
        for (const copy of comparison.foundAgain) {
          if (await this.#copies.transition(copy._id, [S.missing, S.lost], S.available)) {
            await this.#audit.record(actor, { action: "inventory.adjust", entity: "Copy", entityId: copy._id, branch: stocktake.branch, before: { status: copy.status }, after: { status: S.available }, reason: `Found in stocktake ${id}` });
          }
        }
      }
      const result = {
        expected: comparison.expected.length,
        found: comparison.expected.length - comparison.missing.length,
        missing: comparison.missing.length,
        foundAgain: comparison.foundAgain.length,
        unexpected: comparison.unexpected.length,
        applied: apply,
      };
      const closed = await this.#stocktakes.updateWhere({ _id: id, status: STOCKTAKE_STATUSES.open }, { $set: { status: STOCKTAKE_STATUSES.closed, closedAt: new Date(), closedBy: actor.userId, result } });
      if (!closed) throw new ConflictError("This stocktake was already closed");
      await this.#audit.record(actor, { action: "stocktake.close", entity: "Stocktake", entityId: id, branch: stocktake.branch, after: result });
    });
    return this.get(id, actor);
  }

  async cancel({ id }, actor) {
    await this.#open(id, actor);
    await this.#stocktakes.updateWhere({ _id: id, status: STOCKTAKE_STATUSES.open }, { $set: { status: STOCKTAKE_STATUSES.cancelled, closedAt: new Date(), closedBy: actor.userId } });
    return this.get(id, actor);
  }

  async #compare(stocktake) {
    const branchId = stocktake.branch._id ?? stocktake.branch;
    const scope = { branch: branchId, ...(stocktake.location && { location: stocktake.location._id ?? stocktake.location }) };
    const [expected, scans] = await Promise.all([
      this.#copies.findMany({ ...scope, status: { $in: SHELF_STATUSES } }, { select: "barcode status" }),
      this.#scans.findMany({ stocktake: stocktake._id }, { select: "barcode copy" }),
    ]);
    const scannedIds = new Set(scans.filter((scan) => scan.copy).map((scan) => String(scan.copy)));
    const expectedIds = new Set(expected.map((copy) => String(copy._id)));
    const extraIds = [...scannedIds].filter((copyId) => !expectedIds.has(copyId));
    const extras = extraIds.length ? await this.#copies.findMany({ _id: { $in: extraIds } }, { select: "barcode status branch" }) : [];
    return {
      expected,
      scanned: scans,
      missing: expected.filter((copy) => !scannedIds.has(String(copy._id))),
      // Missing/lost copies of this branch that were on the shelf after all.
      foundAgain: extras.filter((copy) => String(copy.branch) === String(branchId) && [S.missing, S.lost].includes(copy.status)),
      unexpected: [
        ...scans.filter((scan) => !scan.copy).map((scan) => scan.barcode),
        ...extras.filter((copy) => String(copy.branch) !== String(branchId) || ![S.missing, S.lost].includes(copy.status)).map((copy) => copy.barcode),
      ],
    };
  }

  async #open(id, actor) {
    const stocktake = ensureFound(await this.#stocktakes.findById(id), "Stocktake not found");
    actor.assertBranch(stocktake.branch);
    if (stocktake.status !== STOCKTAKE_STATUSES.open) throw new BadRequestError("This stocktake is closed");
    return stocktake;
  }
}
