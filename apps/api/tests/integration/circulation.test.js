// Circulation on a real MongoDB replica set: transactions, unique indexes and
// concurrent requests behave here exactly as in production.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ADMIN, DAY, seedLibrary, setDueDate, staffAt, useDatabase } from "./harness.js";

const statusOf = async (c, copy) => (await c.copyRepository.findById(copy._id)).status;
const rejects = (promise, status, message) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `${error.message}`);
    if (message) assert.match(error.message, message);
    return true;
  });

describe("checkout and return", () => {
  const db = useDatabase();

  test("lends an available copy, and the return shelves it again", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 1 });
    const loan = await c.circulationService.checkout({ barcode: copies[0].barcode, member: members[0].memberNumber }, ADMIN);
    assert.equal(loan.status, "active");
    assert.equal(await statusOf(c, copies[0]), "on_loan");
    assert.ok(new Date(loan.dueAt) - Date.now() > 13 * DAY);

    const { next, fine } = await c.circulationService.checkin({ barcode: copies[0].barcode }, ADMIN);
    assert.equal(next, "shelved");
    assert.equal(fine, 0);
    assert.equal(await statusOf(c, copies[0]), "available");
  });

  test("two desks lending the same copy at the same moment: exactly one succeeds", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 2 });
    const results = await Promise.allSettled(
      members.map((member) => c.circulationService.checkout({ barcode: copies[0].barcode, member: String(member._id) }, ADMIN))
    );
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.find((result) => result.status === "rejected").reason.status, 409);
    assert.equal(await c.loanRepository.countWhere({ copy: copies[0]._id, status: "active" }), 1);
  });

  test("a member can never exceed the loan limit, even with concurrent checkouts", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 4, members: 1, type: { loanLimit: 2 } });
    const results = await Promise.allSettled(
      copies.map((copy) => c.circulationService.checkout({ barcode: copy.barcode, member: String(members[0]._id) }, ADMIN))
    );
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
    assert.equal(await c.loanRepository.countActive(members[0]._id), 2);
    for (const rejected of results.filter((result) => result.status === "rejected")) {
      assert.match(rejected.reason.message, /Loan limit/);
    }
  });

  test("staff can override the limit with a reason, and the override is audited", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 2, members: 1, type: { loanLimit: 1 } });
    await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    await rejects(c.circulationService.checkout({ barcode: copies[1].barcode, member: String(members[0]._id) }, ADMIN), 403, /Loan limit/);
    const loan = await c.circulationService.checkout({ barcode: copies[1].barcode, member: String(members[0]._id), overrideReason: "Exam week exception" }, ADMIN);
    assert.equal(loan.overrideReason, "Exam week exception");
    const audit = await c.auditLogRepository.findOne({ action: "loan.checkout_override", entityId: String(loan._id) });
    assert.equal(audit.reason, "Exam week exception");
  });

  test("suspended and expired members cannot borrow, overrides or not", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 2 });
    await c.memberService.suspend({ id: members[0]._id, reason: "Unpaid fines" }, ADMIN);
    await rejects(c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id), overrideReason: "please please" }, ADMIN), 403, /suspended/);
    await c.memberRepository.updateById(members[1]._id, { expiresAt: new Date(Date.now() - DAY) });
    await rejects(c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[1]._id) }, ADMIN), 403, /expired/);
    assert.equal(await statusOf(c, copies[0]), "available");
  });

  test("a late return charges the configured overdue fine once", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 1, settings: { fines: { overduePerDay: 250, graceDays: 1, maxOverduePerLoan: 1000 } } });
    const loan = await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    await setDueDate(c, loan._id, new Date(Date.now() - 3 * DAY - 60_000)); // 4 days late (partial day counts)
    const { fine } = await c.circulationService.checkin({ barcode: copies[0].barcode }, ADMIN);
    assert.equal(fine, 750); // (4 - 1 grace) × 250
    assert.equal(await c.fineRepository.outstandingBalance(members[0]._id), 750);
    await rejects(c.circulationService.checkin({ barcode: copies[0].barcode }, ADMIN), 400, /not on loan/);
    assert.equal(await c.fineRepository.countWhere({ loan: loan._id }), 1);
  });

  test("a damaged return keeps the copy out of circulation", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 1 });
    await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    const { next } = await c.circulationService.checkin({ barcode: copies[0].barcode, damaged: true, notes: "Water damage" }, ADMIN);
    assert.equal(next, "damaged");
    assert.equal(await statusOf(c, copies[0]), "damaged");
  });

  test("declaring a loan lost closes it and charges the copy's recorded cost", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 1 });
    const loan = await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    await c.circulationService.declareLost({ id: loan._id, reason: "Left on a train" }, ADMIN);
    assert.equal((await c.loanRepository.findById(loan._id)).status, "lost");
    assert.equal(await statusOf(c, copies[0]), "lost");
    assert.equal(await c.fineRepository.outstandingBalance(members[0]._id), 5000);
  });

  test("staff of another branch cannot lend this branch's copies", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 1 });
    const other = await c.branchRepository.create({ code: "OTHER1", name: "Other" });
    await rejects(c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, staffAt(other._id)), 403);
  });
});

describe("renewals", () => {
  const db = useDatabase();

  test("renews up to the membership type's limit", async () => {
    const c = db.container;
    const { copies, members } = await seedLibrary(c, { copies: 1, members: 1, type: { maxRenewals: 1 } });
    const loan = await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    const renewed = await c.circulationService.renew({ id: loan._id }, ADMIN);
    assert.equal(renewed.renewals, 1);
    await rejects(c.circulationService.renew({ id: loan._id }, ADMIN), 400, /renewal limit/);
  });

  test("overdue loans and titles others are waiting for are not renewed", async () => {
    const c = db.container;
    const { book, branch, copies, members } = await seedLibrary(c, { copies: 1, members: 2, type: { maxRenewals: 5 } });
    const loan = await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    await c.reservationService.placeForMember({ member: members[1]._id, book: book._id, pickupBranch: branch._id }, ADMIN);
    await rejects(c.circulationService.renew({ id: loan._id }, ADMIN), 400, /waiting/);
    await setDueDate(c, loan._id, new Date(Date.now() - DAY));
    await rejects(c.circulationService.renew({ id: loan._id }, ADMIN), 400, /Overdue/);
  });
});

describe("reservations", () => {
  const db = useDatabase();

  test("the returned copy is held for the first member in the queue, who is notified", async () => {
    const c = db.container;
    const { book, branch, copies, members } = await seedLibrary(c, { copies: 1, members: 3 });
    await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    const first = await c.reservationService.placeForMember({ member: members[1]._id, book: book._id, pickupBranch: branch._id }, ADMIN);
    const second = await c.reservationService.placeForMember({ member: members[2]._id, book: book._id, pickupBranch: branch._id }, ADMIN);
    assert.equal(first.queuePosition, 1);
    assert.equal(second.queuePosition, 2);

    const { next } = await c.circulationService.checkin({ barcode: copies[0].barcode }, ADMIN);
    assert.equal(next, "held");
    assert.equal((await c.reservationService.get(first._id)).status, "ready");
    assert.equal(await statusOf(c, copies[0]), "on_hold");
    assert.equal(await c.notificationRepository.countWhere({ member: members[1]._id, type: "reservation.ready" }), 1);

    // Only the member it is held for can borrow it; doing so fulfils the reservation.
    await rejects(c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[2]._id) }, ADMIN), 409, /on hold/);
    await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[1]._id) }, ADMIN);
    assert.equal((await c.reservationService.get(first._id)).status, "fulfilled");
  });

  test("one open reservation per member and title, within the member's limit", async () => {
    const c = db.container;
    const { book, branch, copies, members } = await seedLibrary(c, { copies: 1, members: 2, type: { reservationLimit: 1 } });
    await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    const place = () => c.reservationService.placeForMember({ member: members[1]._id, book: book._id, pickupBranch: branch._id }, ADMIN);
    const results = await Promise.allSettled([place(), place()]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await c.reservationRepository.countOpen(members[1]._id), 1);
    await rejects(c.reservationService.placeForMember({ member: members[0]._id, book: book._id, pickupBranch: branch._id }, ADMIN), 409, /already on loan/);
  });

  test("cancelling a ready reservation passes the copy to the next member", async () => {
    const c = db.container;
    const { book, branch, copies, members } = await seedLibrary(c, { copies: 1, members: 3 });
    await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, ADMIN);
    const first = await c.reservationService.placeForMember({ member: members[1]._id, book: book._id, pickupBranch: branch._id }, ADMIN);
    const second = await c.reservationService.placeForMember({ member: members[2]._id, book: book._id, pickupBranch: branch._id }, ADMIN);
    await c.circulationService.checkin({ barcode: copies[0].barcode }, ADMIN);
    await c.reservationService.cancel({ id: first._id, reason: "No longer needed" }, ADMIN);
    assert.equal((await c.reservationService.get(second._id)).status, "ready");
    assert.equal(String((await c.copyRepository.findById(copies[0]._id)).reservation), String(second._id));
  });

  test("uncollected holds expire and the copy goes back on the shelf", async () => {
    const c = db.container;
    const { book, branch, copies, members } = await seedLibrary(c, { copies: 1, members: 1 });
    const reservation = await c.reservationService.placeForMember({ member: members[0]._id, book: book._id, pickupBranch: branch._id }, ADMIN);
    assert.equal(reservation.status, "ready"); // a copy was on the shelf: held at once
    await c.reservationRepository.updateById(reservation._id, { expiresAt: new Date(Date.now() - 1000) });
    assert.equal(await c.reservationService.expireOverdueHolds(ADMIN), 1);
    assert.equal((await c.reservationService.get(reservation._id)).status, "expired");
    assert.equal(await statusOf(c, copies[0]), "available");
  });

  test("a reservation at another branch sends a copy there; receiving it makes it ready", async () => {
    const c = db.container;
    const { book, copies, members } = await seedLibrary(c, { copies: 1, members: 1 });
    const pickup = await c.branchRepository.create({ code: "PICKUP1", name: "Pickup branch" });
    const reservation = await c.reservationService.placeForMember({ member: members[0]._id, book: book._id, pickupBranch: pickup._id }, ADMIN);
    assert.equal(reservation.status, "in_transit");
    assert.equal(await statusOf(c, copies[0]), "in_transit");
    const transfer = await c.transferRepository.findOne({ copy: copies[0]._id, status: "in_transit" });
    assert.equal(transfer.reason, "reservation");

    await c.transferService.receive({ id: transfer._id }, staffAt(pickup._id));
    assert.equal((await c.reservationService.get(reservation._id)).status, "ready");
    assert.equal(await statusOf(c, copies[0]), "on_hold");

    // Borrowed at the pickup desk, returned there: it travels home.
    await c.circulationService.checkout({ barcode: copies[0].barcode, member: String(members[0]._id) }, staffAt(pickup._id));
    const { next } = await c.circulationService.checkin({ barcode: copies[0].barcode, branch: String(pickup._id) }, staffAt(pickup._id));
    assert.equal(next, "transfer");
    assert.equal((await c.transferRepository.findOne({ copy: copies[0]._id, status: "in_transit" })).reason, "return_home");
  });
});

describe("transfers between branches", () => {
  const db = useDatabase();

  test("requested → shipped → received moves the copy to the new branch, with history", async () => {
    const c = db.container;
    const { branch, copies } = await seedLibrary(c, { copies: 1, members: 0 });
    const target = await c.branchRepository.create({ code: "NORTH1", name: "North" });
    const requested = await c.transferService.create({ barcode: copies[0].barcode, toBranch: target._id, note: "Rebalance" }, ADMIN);
    assert.equal(requested.status, "requested");
    assert.equal(await statusOf(c, copies[0]), "available");
    await rejects(c.transferService.ship({ id: requested._id }, staffAt(target._id)), 403);
    await c.transferService.ship({ id: requested._id }, staffAt(branch._id));
    assert.equal(await statusOf(c, copies[0]), "in_transit");
    const received = await c.transferService.receive({ id: requested._id }, staffAt(target._id));
    assert.deepEqual(received.history.map((entry) => entry.status), ["requested", "in_transit", "received"]);
    const copy = await c.copyRepository.findById(copies[0]._id);
    assert.equal(String(copy.branch), String(target._id));
    assert.equal(copy.status, "available");
  });
});
