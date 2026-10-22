import { CrudService } from "../../core/crud-service.js";
import { pageOf, toSort } from "../../core/pagination.js";
import { PURCHASE_ORDER_POPULATE } from "./acquisition.repository.js";
import { PURCHASE_STATUSES } from "./acquisition.model.js";
import { PurchaseOrderResponseDto, SupplierResponseDto } from "./acquisition.dto.js";
import { BadRequestError, ConflictError, ensureFound } from "../../core/http-errors.js";

const P = PURCHASE_STATUSES;
const NOT_FOUND = "Purchase order not found";

export class SupplierService extends CrudService {
  static entity = "Supplier";
  static searchFields = ["name", "contactName", "email"];
  static Dto = SupplierResponseDto;

  #orders;

  constructor({ supplierRepository, purchaseOrderRepository, auditService }) {
    super({ repository: supplierRepository, auditService });
    this.#orders = purchaseOrderRepository;
  }

  async beforeDelete(supplier) {
    if (await this.#orders.countWhere({ supplier: supplier._id })) {
      throw new ConflictError("Purchase orders reference this supplier. Deactivate it instead.");
    }
  }
}

/**
 * Purchase requests → approval → purchase orders → deliveries. Receiving a
 * delivery adds the copies to the receiving branch's inventory with their cost,
 * supplier and order, in the same transaction.
 */
export class PurchaseOrderService {
  #orders;
  #suppliers;
  #books;
  #branches;
  #copyService;
  #settings;
  #sequences;
  #files;
  #transactions;
  #audit;

  constructor({ purchaseOrderRepository, supplierRepository, bookRepository, branchRepository, copyService, settingsService, sequenceGenerator, privateFileStorage, transactionRunner, auditService }) {
    this.#orders = purchaseOrderRepository;
    this.#suppliers = supplierRepository;
    this.#books = bookRepository;
    this.#branches = branchRepository;
    this.#copyService = copyService;
    this.#settings = settingsService;
    this.#sequences = sequenceGenerator;
    this.#files = privateFileStorage;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  async list({ page, limit, sort, status, supplier, branch }, actor) {
    const filter = { ...actor.branchFilter("branch") };
    if (status) filter.status = status;
    if (supplier) filter.supplier = supplier;
    if (branch) filter.branch = branch;
    const result = await this.#orders.paginate(filter, { page, limit, sort: toSort(sort), populate: PURCHASE_ORDER_POPULATE });
    return pageOf({ ...result, items: PurchaseOrderResponseDto.fromList(result.items) }, { page, limit });
  }

  async get(id, actor) {
    const order = ensureFound(await this.#orders.findById(id, { populate: PURCHASE_ORDER_POPULATE }), NOT_FOUND);
    actor?.assertBranch(order.branch._id);
    return PurchaseOrderResponseDto.from(order);
  }

  /** @param {import("./acquisition.dto.js").CreatePurchaseRequestDto} dto */
  async createRequest({ branch, supplier, lines, notes }, actor) {
    actor.assertBranch(branch);
    ensureFound(await this.#branches.findById(branch), "Branch not found");
    await this.#assertReferences({ supplier, lines });
    const { currency } = await this.#settings.get();
    const order = await this.#orders.create({ branch, supplier: supplier ?? null, lines, notes, currency, requestedBy: actor.userId });
    await this.#audit.record(actor, { action: "purchase.request", entity: "PurchaseOrder", entityId: order._id, branch, after: { lines } });
    return this.get(order._id, actor);
  }

  /** Lines and supplier can change until the order is sent. */
  async update({ id, ...changes }, actor) {
    const order = await this.#editable(id, actor, [P.requested, P.approved]);
    await this.#assertReferences({ supplier: changes.supplier, lines: changes.lines ?? [] });
    const update = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    const updated = await this.#orders.updateWhere({ _id: id, status: order.status }, { $set: update });
    if (!updated) throw new ConflictError("The order changed meanwhile. Reload and try again.");
    await this.#audit.record(actor, { action: "purchase.update", entity: "PurchaseOrder", entityId: id, branch: order.branch, before: { lines: order.lines, supplier: order.supplier }, after: update });
    return this.get(id, actor);
  }

  approve({ id, note }, actor) {
    return this.#move(id, P.requested, P.approved, actor, { approvedBy: actor.userId }, note);
  }

  reject({ id, note }, actor) {
    return this.#move(id, P.requested, P.rejected, actor, { closedAt: new Date() }, note);
  }

  cancel({ id, note }, actor) {
    return this.#move(id, [P.requested, P.approved, P.ordered], P.cancelled, actor, { closedAt: new Date() }, note);
  }

  /** Sends an approved request to its supplier: it gets a PO number. Every line must be a catalogued book. */
  async placeOrder({ id, note }, actor) {
    const order = await this.#editable(id, actor, [P.approved]);
    if (!order.supplier) throw new BadRequestError("Choose a supplier before ordering");
    if (order.lines.some((item) => !item.book)) throw new BadRequestError("Catalogue every requested title before ordering");
    const number = await this.#sequences.nextCode("purchase-order", "PO", 6);
    return this.#move(id, P.approved, P.ordered, actor, { number, orderedAt: new Date() }, note);
  }

  /**
   * Records a delivery: adds the received copies to inventory (barcodes are
   * generated) and updates the received counts. Over-delivery is refused.
   * @param {import("./acquisition.dto.js").ReceiveDeliveryDto} dto
   */
  async receive({ id, reference, lines }, actor) {
    const order = await this.#editable(id, actor, [P.ordered, P.partiallyReceived]);
    const byId = new Map(order.lines.map((item) => [String(item._id), item]));
    for (const { line, quantity } of lines) {
      const item = byId.get(line);
      if (!item) throw new BadRequestError("Unknown order line");
      if (item.received + quantity > item.quantity) {
        throw new BadRequestError(`Only ${item.quantity - item.received} more cop(ies) of a line are expected`);
      }
    }

    await this.#transactions.run(async () => {
      const deliveryLines = [];
      for (const { line, quantity } of lines) {
        const item = byId.get(line);
        const copies = await this.#copyService.addCopies(
          { book: item.book, branch: order.branch, count: quantity, condition: "new", cost: item.unitCost },
          actor,
          { supplier: order.supplier, purchaseOrder: order._id }
        );
        deliveryLines.push({ line: item._id, quantity, copies: copies.map((copy) => copy._id) });
        item.received += quantity;
      }
      const complete = order.lines.every((item) => item.received >= item.quantity);
      const updated = await this.#orders.updateWhere(
        { _id: id, status: order.status, updatedAt: order.updatedAt }, // nobody received meanwhile
        {
          $set: {
            lines: order.lines,
            status: complete ? P.received : P.partiallyReceived,
            ...(complete && { closedAt: new Date() }),
          },
          $push: { deliveries: { receivedAt: new Date(), receivedBy: actor.userId, branch: order.branch, reference, lines: deliveryLines } },
        }
      );
      if (!updated) throw new ConflictError("The order changed meanwhile. Reload and try again.");
      await this.#audit.record(actor, { action: "purchase.receive", entity: "PurchaseOrder", entityId: id, branch: order.branch, after: { reference, lines } });
    });
    return this.get(id, actor);
  }

  /** Attaches a purchase document (quote, invoice, delivery note) in private storage. */
  async addDocument(id, file, actor) {
    if (!file) throw new BadRequestError("Attach a file");
    const order = ensureFound(await this.#orders.findById(id), NOT_FOUND);
    actor.assertBranch(order.branch);
    const key = await this.#files.save(file.path, { folder: "purchase-documents", originalName: file.originalname });
    const document = { key, name: file.originalname, mimeType: file.mimetype, size: file.size, uploadedBy: actor.userId };
    await this.#orders.updateById(id, { $push: { documents: document } });
    await this.#audit.record(actor, { action: "purchase.document_add", entity: "PurchaseOrder", entityId: id, branch: order.branch, after: { name: file.originalname } });
    return this.get(id, actor);
  }

  /** Resolves `{ stream, size, name, mimeType }` for an authorised download. */
  async openDocument(id, documentId, actor) {
    const order = ensureFound(await this.#orders.findById(id), NOT_FOUND);
    actor.assertBranch(order.branch);
    const document = ensureFound(order.documents.find((item) => String(item._id) === documentId), "Document not found");
    return { ...(await this.#files.open(document.key)), name: document.name, mimeType: document.mimeType };
  }

  async #move(id, from, to, actor, fields, note) {
    const order = ensureFound(await this.#orders.findById(id), NOT_FOUND);
    actor.assertBranch(order.branch);
    const updated = await this.#orders.transition(id, from, to, fields);
    if (!updated) throw new BadRequestError(`A ${order.status.replace("_", " ")} order cannot become ${to.replace("_", " ")}`);
    await this.#audit.record(actor, { action: `purchase.${to}`, entity: "PurchaseOrder", entityId: id, branch: order.branch, before: { status: order.status }, after: { status: to, ...fields }, reason: note });
    return this.get(id, actor);
  }

  async #editable(id, actor, statuses) {
    const order = ensureFound(await this.#orders.findById(id), NOT_FOUND);
    actor.assertBranch(order.branch);
    if (!statuses.includes(order.status)) {
      const expected = statuses.map((status) => status.replace("_", " ")).join(" or ");
      throw new BadRequestError(`This order is ${order.status.replace("_", " ")}; it must be ${expected} for this step`);
    }
    return order;
  }

  async #assertReferences({ supplier, lines }) {
    if (supplier) {
      const found = ensureFound(await this.#suppliers.findById(supplier), "Supplier not found");
      if (!found.isActive) throw new BadRequestError("This supplier is inactive");
    }
    const bookIds = [...new Set(lines.filter((item) => item.book).map((item) => item.book))];
    if (bookIds.length && (await this.#books.countWhere({ _id: { $in: bookIds } })) !== bookIds.length) {
      throw new BadRequestError("Unknown book in the order lines");
    }
  }
}
