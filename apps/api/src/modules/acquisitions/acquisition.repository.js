import { purchaseOrderModel, supplierModel } from "./acquisition.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export const PURCHASE_ORDER_POPULATE = [
  { path: "supplier", select: "name" },
  { path: "branch", select: "code name" },
  { path: "lines.book", select: "bookTitle author isbn" },
];

export class SupplierRepository extends BaseRepository {
  constructor(model = supplierModel) {
    super(model);
  }
}

export class PurchaseOrderRepository extends BaseRepository {
  constructor(model = purchaseOrderModel) {
    super(model);
  }

  transition(id, from, to, fields = {}) {
    return this.updateWhere({ _id: id, status: { $in: [].concat(from) } }, { $set: { status: to, ...fields } });
  }
}
