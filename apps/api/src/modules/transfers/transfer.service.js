import { TRANSFER_POPULATE } from "./transfer.repository.js";
import { TRANSFER_REASONS, TRANSFER_STATUSES } from "./transfer.model.js";
import { COPY_STATUSES } from "../copies/copy-statuses.js";
import { RESERVATION_STATUSES } from "../circulation/circulation-statuses.js";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";
import { pageOf, paginationKeys, toSort } from "../../core/pagination.js";
import { BadRequestError, ConflictError, ensureFound } from "../../core/http-errors.js";
import joi from "joi";

const T = TRANSFER_STATUSES;
const S = COPY_STATUSES;

export class ListTransfersDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["createdAt", "updatedAt"]),
    status: joi.string().valid(...Object.values(T)),
    reason: joi.string().valid(...Object.values(TRANSFER_REASONS)),
    fromBranch: fields.ref(),
    toBranch: fields.ref(),
  });
}

export class CreateTransferDto extends RequestDto {
  static schema = joi.object({
    barcode: joi.string().trim().uppercase().max(40).required(),
    toBranch: fields.objectId(),
    note: joi.string().trim().max(500).allow(""),
    // Ship at once (the source branch is creating it) instead of only requesting it.
    ship: joi.boolean().default(false),
  });
}

export class TransferActionDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), note: joi.string().trim().max(500).allow("") });
}

export class TransferResponseDto extends ResponseDto {
  static fields = ["_id", "copy", "book", "fromBranch", "toBranch", "status", "reason", "reservation", "note", "history", "createdAt", "updatedAt"];
}

/**
 * Moving copies between branches: requested → in transit → received (or
 * cancelled), with history. The source branch ships, the destination receives.
 */
export class TransferService {
  #transfers;
  #copies;
  #branches;
  #reservations;
  #allocator;
  #transactions;
  #audit;

  constructor({ transferRepository, copyRepository, branchRepository, reservationRepository, copyAllocator, transactionRunner, auditService }) {
    this.#transfers = transferRepository;
    this.#copies = copyRepository;
    this.#branches = branchRepository;
    this.#reservations = reservationRepository;
    this.#allocator = copyAllocator;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  /** Transfers into or out of the actor's branches. */
  async list({ page, limit, sort, status, reason, fromBranch, toBranch }, actor) {
    const filter = actor.allBranches ? {} : { $or: [actor.branchFilter("fromBranch"), actor.branchFilter("toBranch")] };
    if (status) filter.status = status;
    if (reason) filter.reason = reason;
    if (fromBranch) filter.fromBranch = fromBranch;
    if (toBranch) filter.toBranch = toBranch;
    const result = await this.#transfers.paginate(filter, { page, limit, sort: toSort(sort), populate: TRANSFER_POPULATE });
    return pageOf({ ...result, items: TransferResponseDto.fromList(result.items) }, { page, limit });
  }

  async get(id) {
    return TransferResponseDto.from(ensureFound(await this.#transfers.findById(id, { populate: TRANSFER_POPULATE }), "Transfer not found"));
  }

  /** Requests (or ships) an available copy to another branch. */
  async create({ barcode, toBranch, note, ship }, actor) {
    const copy = ensureFound(await this.#copies.findByBarcode(barcode), "No copy has this barcode");
    const fromBranch = copy.branch._id;
    if (String(fromBranch) === String(toBranch)) throw new BadRequestError("The copy is already at that branch");
    if (ship) actor.assertBranch(fromBranch, "Only the copy's branch can ship it");
    else if (!actor.canAccessBranch(toBranch) && !actor.canAccessBranch(fromBranch)) actor.assertBranch(toBranch);
    const destination = ensureFound(await this.#branches.findById(toBranch), "Branch not found");
    if (!destination.isActive) throw new BadRequestError("The destination branch is inactive");
    if (copy.status !== S.available) throw new BadRequestError(`Only available copies can be transferred (this one is ${copy.status})`);

    const transfer = await this.#transactions.run(async () => {
      const status = ship ? T.inTransit : T.requested;
      const created = await this.#transfers.create({
        copy: copy._id, book: copy.book._id, fromBranch, toBranch, status, reason: TRANSFER_REASONS.rebalancing, note,
        history: [{ status, at: new Date(), by: actor.userId, note }],
      });
      if (ship) await this.#takeOffShelf(copy._id, created._id);
      await this.#audit.record(actor, { action: `transfer.${ship ? "ship" : "request"}`, entity: "Transfer", entityId: created._id, branch: fromBranch, after: { barcode, fromBranch, toBranch } });
      return created;
    });
    return this.get(transfer._id);
  }

  /** The source branch sends a requested transfer. */
  async ship({ id, note }, actor) {
    const transfer = ensureFound(await this.#transfers.findById(id), "Transfer not found");
    actor.assertBranch(transfer.fromBranch, "Only the source branch can ship this transfer");
    await this.#transactions.run(async () => {
      if (!(await this.#transfers.transition(id, T.requested, T.inTransit, { by: actor.userId, note }))) {
        throw new ConflictError("Only requested transfers can be shipped");
      }
      await this.#takeOffShelf(transfer.copy, id);
      await this.#audit.record(actor, { action: "transfer.ship", entity: "Transfer", entityId: id, branch: transfer.fromBranch, before: { status: T.requested }, after: { status: T.inTransit } });
    });
    return this.get(id);
  }

  /** The destination branch confirms arrival; the copy is then held, or shelved there. */
  async receive({ id, note }, actor) {
    const transfer = ensureFound(await this.#transfers.findById(id), "Transfer not found");
    actor.assertBranch(transfer.toBranch, "Only the destination branch can receive this transfer");
    await this.#transactions.run(async () => {
      if (!(await this.#transfers.transition(id, T.inTransit, T.received, { by: actor.userId, note }))) {
        throw new ConflictError("Only transfers in transit can be received");
      }
      const copy = ensureFound(await this.#copies.findById(transfer.copy), "Copy not found");
      const reservation = transfer.reservation ? await this.#reservations.findById(transfer.reservation) : null;
      if (reservation?.status === RESERVATION_STATUSES.inTransit) {
        await this.#allocator.hold(copy, reservation, actor);
      } else if (transfer.reason === TRANSFER_REASONS.rebalancing) {
        // Moved stock now belongs to the destination branch.
        const rehomed = await this.#copies.updateWhere({ _id: copy._id, status: S.inTransit }, { $set: { branch: transfer.toBranch, location: null, transfer: null } });
        if (!rehomed) throw new ConflictError("The copy changed meanwhile. Please retry.");
        await this.#allocator.release(rehomed, transfer.toBranch, actor);
      } else {
        // Back home, or a reservation cancelled on the way: shelve or reallocate it here.
        await this.#allocator.release({ ...copy, transfer: null, reservation: null }, transfer.toBranch, actor);
      }
      await this.#audit.record(actor, { action: "transfer.receive", entity: "Transfer", entityId: id, branch: transfer.toBranch, before: { status: T.inTransit }, after: { status: T.received } });
    });
    return this.get(id);
  }

  /** Cancels a requested transfer, or one in transit (the copy goes back to its source). */
  async cancel({ id, note }, actor) {
    const transfer = ensureFound(await this.#transfers.findById(id), "Transfer not found");
    if (!actor.canAccessBranch(transfer.fromBranch)) actor.assertBranch(transfer.toBranch);
    await this.#transactions.run(async () => {
      if (!(await this.#transfers.transition(id, [T.requested, T.inTransit], T.cancelled, { by: actor.userId, note }))) {
        throw new ConflictError("This transfer is already closed");
      }
      if (transfer.status === T.inTransit) {
        const copy = await this.#copies.findById(transfer.copy);
        if (transfer.reservation) {
          // The reservation goes back to the queue.
          await this.#reservations.transition(transfer.reservation, RESERVATION_STATUSES.inTransit, RESERVATION_STATUSES.waiting, { copy: null });
        }
        await this.#copies.updateById(copy._id, { transfer: null, reservation: null });
        await this.#allocator.release({ ...copy, transfer: null, reservation: null }, transfer.fromBranch, actor);
      }
      await this.#audit.record(actor, { action: "transfer.cancel", entity: "Transfer", entityId: id, branch: transfer.fromBranch, before: { status: transfer.status }, after: { status: T.cancelled }, reason: note });
    });
    return this.get(id);
  }

  async #takeOffShelf(copyId, transferId) {
    if (!(await this.#copies.transition(copyId, S.available, S.inTransit, { transfer: transferId }))) {
      throw new ConflictError("The copy is no longer available");
    }
  }
}
