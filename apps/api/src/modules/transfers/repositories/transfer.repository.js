import { transferModel } from "../models/transfer.model.js";
import { BaseRepository } from "../../../core/base-repository.js";

export const TRANSFER_POPULATE = [
  { path: "copy", select: "barcode status" },
  { path: "book", select: "bookTitle author" },
  { path: "fromBranch", select: "code name" },
  { path: "toBranch", select: "code name" },
];

export class TransferRepository extends BaseRepository {
  constructor(model = transferModel) {
    super(model);
  }

  /** Guarded status change that also appends to the history. */
  transition(transferId, from, to, { by, note } = {}) {
    return this.updateWhere(
      { _id: transferId, status: { $in: [].concat(from) } },
      { $set: { status: to }, $push: { history: { status: to, at: new Date(), by, note } } }
    );
  }
}
