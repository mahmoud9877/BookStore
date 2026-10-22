// Finance, inventory, acquisitions and rooms on a real MongoDB replica set.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PAYMENT_OUTCOMES } from "../../src/modules/orders/payment-gateway.js";
import { ADMIN, DAY, seedLibrary, staffAt, useDatabase } from "./harness.js";

const rejects = (promise, status, message) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `${error.message}`);
    if (message) assert.match(error.message, message);
    return true;
  });

/** A stand-in card provider: checkout sessions and refunds succeed. */
const fakeGateway = {
  isConfigured: true,
  sessions: [],
  refunds: [],
  async createPaymentCheckout(request) {
    this.sessions.push(request);
    return { id: `cs_${this.sessions.length}`, url: "https://pay.example/checkout" };
  },
  async refund(request) {
    this.refunds.push(request);
    return { id: `re_${this.refunds.length}` };
  },
  parseWebhookEvent() {
    throw new Error("not used");
  },
};

describe("fines and payments", () => {
  const db = useDatabase({ paymentGateway: fakeGateway });

  const memberWithFines = async (c, amounts) => {
    const { members, branch } = await seedLibrary(c, { copies: 0, members: 1 });
    for (const amount of amounts) await c.fineService.addManual({ member: members[0]._id, amount, reason: "Test charge" }, ADMIN);
    return { member: members[0], branch };
  };

  test("cash pays the oldest fines first; a repeated request is not recorded twice", async () => {
    const c = db.container;
    const { member } = await memberWithFines(c, [300, 500]);
    const payment = await c.paymentService.recordCash({ member: member._id, amount: 400, idempotencyKey: "desk-1-abc123" }, ADMIN);
    assert.deepEqual(payment.allocations.map((allocation) => allocation.amount), [300, 100]);
    assert.ok(payment.receiptNumber.startsWith("R-"));
    const again = await c.paymentService.recordCash({ member: member._id, amount: 400, idempotencyKey: "desk-1-abc123" }, ADMIN);
    assert.equal(String(again._id), String(payment._id));
    assert.equal(await c.paymentRepository.countWhere({ member: member._id }), 1);
    assert.equal(await c.fineRepository.outstandingBalance(member._id), 400);
    await rejects(c.paymentService.recordCash({ member: member._id, amount: 401 }, ADMIN), 400, /exceeds/);
  });

  test("waiving and refunding are audited, and a refund reopens the fine", async () => {
    const c = db.container;
    const { member } = await memberWithFines(c, [1000]);
    const [fine] = await c.fineRepository.listOutstanding(member._id);
    await c.fineService.waive({ id: fine._id, amount: 200, reason: "Goodwill" }, ADMIN);
    const payment = await c.paymentService.recordCash({ member: member._id, amount: 800 }, ADMIN);
    assert.equal((await c.fineRepository.findById(fine._id)).status, "waived"); // closed, partly waived
    const refunded = await c.paymentService.refund({ id: payment._id, amount: 300, reason: "Charged twice" }, ADMIN);
    assert.equal(refunded.status, "partially_refunded");
    assert.equal(await c.fineRepository.outstandingBalance(member._id), 300);
    assert.ok(await c.auditLogRepository.findOne({ action: "fine.waive", entityId: String(fine._id) }));
    assert.ok(await c.auditLogRepository.findOne({ action: "payment.refund", entityId: String(payment._id) }));
    await rejects(c.paymentService.refund({ id: payment._id, amount: 501, reason: "Too much" }, ADMIN), 400);
  });

  test("a card payment is applied once, only after the verified provider event", async () => {
    const c = db.container;
    const { member } = await memberWithFines(c, [700]);
    const user = await c.userRepository.create({ userName: "payer", email: `payer${Date.now()}@example.com`, password: "x", confirmEmail: true });
    await c.memberRepository.updateById(member._id, { user: user._id });

    const { payment, url } = await c.paymentService.startCardCheckout(user._id, {});
    assert.equal(url, "https://pay.example/checkout");
    assert.equal(fakeGateway.sessions.at(-1).amount, 700); // the server's figure, not the client's
    assert.equal(await c.fineRepository.outstandingBalance(member._id), 700); // nothing applied yet

    const event = { outcome: PAYMENT_OUTCOMES.paid, paymentId: String(payment._id), paymentRef: "pi_123" };
    assert.equal(await c.paymentService.applyProviderOutcome(event), "succeeded");
    assert.equal(await c.paymentService.applyProviderOutcome(event), "ignored"); // duplicate delivery
    assert.equal(await c.fineRepository.outstandingBalance(member._id), 0);

    await c.paymentService.refund({ id: payment._id, amount: 700, reason: "Returned the book after all" }, ADMIN);
    assert.equal(fakeGateway.refunds.at(-1).paymentRef, "pi_123");
  });

  test("members over the balance limit cannot borrow", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 1, settings: { circulation: { blockBorrowingAboveBalance: 500 } } });
    await c.fineService.addManual({ member: members[0]._id, amount: 600, reason: "Old charge" }, ADMIN);
    await rejects(c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN), 403, /fines/);
    const { version, ...settings } = await c.settingsService.get();
    await c.settingsService.update({ ...settings, circulation: { ...settings.circulation, blockBorrowingAboveBalance: null }, version }, ADMIN);
  });
});

describe("inventory", () => {
  const db = useDatabase();

  test("manual adjustments follow the allowed transitions and are audited with a reason", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 2, members: 1 });
    await c.copyService.adjustStatus({ id: copies[0]._id, status: "damaged", reason: "Torn pages" }, ADMIN);
    await rejects(c.copyService.adjustStatus({ id: copies[0]._id, status: "on_loan", reason: "sneaky" }, ADMIN), 400);
    await c.circulationService.checkout({ barcode: copies[1].barcode, member: String(members[0]._id) }, ADMIN);
    await rejects(c.copyService.adjustStatus({ id: copies[1]._id, status: "lost", reason: "Lost?" }, ADMIN), 400);
    const audit = await c.auditLogRepository.findOne({ action: "inventory.adjust", entityId: String(copies[0]._id) });
    assert.equal(audit.reason, "Torn pages");
  });

  test("a stocktake finds missing copies and copies that turned up again", async () => {
    const c = db.container;
    const { branch, copies } = await seedLibrary(c, { copies: 3, members: 0 });
    await c.copyService.adjustStatus({ id: copies[2]._id, status: "missing", reason: "Not on shelf last year" }, ADMIN);
    const stocktake = await c.stocktakeService.start({ branch: branch._id }, ADMIN);
    await rejects(c.stocktakeService.start({ branch: branch._id }, ADMIN), 409);
    const progress = await c.stocktakeService.scan({ id: stocktake._id, barcodes: [copies[0].barcode, copies[2].barcode, "UNKNOWN-1"] }, ADMIN);
    assert.deepEqual(progress.progress.missing, [copies[1].barcode]);
    assert.deepEqual(progress.progress.foundAgain, [copies[2].barcode]);
    assert.deepEqual(progress.progress.unexpected, ["UNKNOWN-1"]);

    const closed = await c.stocktakeService.close({ id: stocktake._id, apply: true }, ADMIN);
    assert.equal(closed.result.missing, 1);
    assert.equal((await c.copyRepository.findById(copies[1]._id)).status, "missing");
    assert.equal((await c.copyRepository.findById(copies[2]._id)).status, "available");
  });
});

describe("acquisitions", () => {
  const db = useDatabase();

  test("request → approve → order → deliveries add costed copies to the branch", async () => {
    const c = db.container;
    const { branch, book } = await seedLibrary(c, { copies: 0, members: 0 });
    const supplier = await c.supplierService.create({ name: `Supplier ${Date.now()}` }, ADMIN);
    const request = await c.purchaseOrderService.createRequest({ branch: branch._id, lines: [{ book: book._id, quantity: 3, unitCost: 1200 }] }, ADMIN);
    assert.equal(request.status, "requested");
    await rejects(c.purchaseOrderService.placeOrder({ id: request._id }, ADMIN), 400, /approved/);
    await c.purchaseOrderService.approve({ id: request._id }, ADMIN);
    await rejects(c.purchaseOrderService.placeOrder({ id: request._id }, ADMIN), 400, /supplier/);
    await c.purchaseOrderService.update({ id: request._id, supplier: supplier._id }, ADMIN);
    const ordered = await c.purchaseOrderService.placeOrder({ id: request._id }, ADMIN);
    assert.match(ordered.number, /^PO-/);
    assert.equal(ordered.totalCost, 3600);

    const lineId = String(ordered.lines[0]._id);
    const partial = await c.purchaseOrderService.receive({ id: request._id, reference: "DN-1", lines: [{ line: lineId, quantity: 2 }] }, ADMIN);
    assert.equal(partial.status, "partially_received");
    await rejects(c.purchaseOrderService.receive({ id: request._id, lines: [{ line: lineId, quantity: 2 }] }, ADMIN), 400, /more/);
    const done = await c.purchaseOrderService.receive({ id: request._id, lines: [{ line: lineId, quantity: 1 }] }, ADMIN);
    assert.equal(done.status, "received");
    assert.equal(done.receivedCost, 3600);

    const copies = await c.copyRepository.findMany({ purchaseOrder: request._id });
    assert.equal(copies.length, 3);
    assert.ok(copies.every((copy) => copy.cost === 1200 && String(copy.supplier) === String(supplier._id)));
  });
});

describe("room bookings", () => {
  const db = useDatabase();

  test("overlapping bookings of a room are refused, even when made at the same moment", async () => {
    const c = db.container;
    const { branch, members } = await seedLibrary(c, { copies: 0, members: 2 });
    const room = await c.roomService.create({ branch: branch._id, name: "Study 1", capacity: 4 }, ADMIN);
    const start = new Date(Date.now() + DAY);
    const book = (member, from, hours) =>
      c.roomBookingService.bookForStaff({ room: room._id, member: member._id, startAt: from, endAt: new Date(from.getTime() + hours * 3_600_000) }, ADMIN);
    const results = await Promise.allSettled([book(members[0], start, 2), book(members[1], new Date(start.getTime() + 3_600_000), 2)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    // Either one may win; a booking starting when the later one would end is fine (back-to-back).
    await book(members[1], new Date(start.getTime() + 3 * 3_600_000), 1);
  });

  test("branch staff cannot book rooms of other branches", async () => {
    const c = db.container;
    const { branch } = await seedLibrary(c, { copies: 0, members: 0 });
    const room = await c.roomService.create({ branch: branch._id, name: "Study 2", capacity: 2 }, ADMIN);
    const other = await c.branchRepository.create({ code: `X${Date.now()}`.slice(0, 12), name: "X" });
    const start = new Date(Date.now() + DAY);
    await rejects(c.roomBookingService.bookForStaff({ room: room._id, startAt: start, endAt: new Date(start.getTime() + 3_600_000) }, staffAt(other._id)), 403);
  });
});
