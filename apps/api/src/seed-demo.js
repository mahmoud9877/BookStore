// Demo data for DEVELOPMENT: branches, shelves, copies, members, loans (one
// overdue), a reservation, a fine, a room and an event — created through the
// same services the API uses, so every rule and audit entry applies.
// `npm run seed:demo` (safe to re-run: it does nothing once demo data exists).
import { env } from "./config/env.js";
import { createContainer } from "./container.js";
import { AccessContext } from "./core/access-context.js";
import { ALL_PERMISSIONS } from "./modules/roles/permissions.js";

if (env.isProduction) {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const DAY = 24 * 60 * 60 * 1000;
const c = createContainer();
await c.database.connect();

const admin = await c.userRepository.findByEmail("admin@bookstore.local");
const reader = await c.userRepository.findByEmail("reader@bookstore.local");
const actor = new AccessContext({ userId: admin?._id ?? null, userName: "demo seed", role: "Admin", permissions: ALL_PERMISSIONS, branchScope: "all" });

try {
  if (await c.memberRepository.countWhere({})) {
    console.log("Demo library data already exists; nothing to do.");
  } else {
    const main = (await c.branchRepository.findOne({ code: "MAIN" })) ?? (await c.branchRepository.create({ code: "MAIN", name: "Main Library" }));
    const east = await c.branchRepository.create({ code: "EAST", name: "East Branch", address: "12 River Rd" });
    const roomA = await c.locationRepository.create({ branch: main._id, type: "room", code: "A", name: "Reading room A" });
    const shelf = await c.locationRepository.create({ branch: main._id, type: "shelf", code: "A-01", name: "Fiction A–M", parent: roomA._id });
    const type = await c.membershipTypeRepository.findOne({ code: "STANDARD" });
    const student = await c.membershipTypeRepository.create({
      code: "STUDENT", name: "Student", description: "Demo values", loanLimit: 8, loanPeriodDays: 21, maxRenewals: 3, reservationLimit: 8, membershipMonths: 12,
    });

    const books = await c.bookRepository.findMany({}, { sort: { createdAt: 1 } });
    const copies = [];
    for (const [index, book] of books.entries()) {
      copies.push(...(await c.copyService.addCopies({ book: book._id, branch: main._id, location: shelf._id, count: 2, condition: "good", cost: 15000 }, actor)));
      if (index % 2 === 0) copies.push(...(await c.copyService.addCopies({ book: book._id, branch: east._id, count: 1, condition: "new", cost: 15000 }, actor)));
    }

    const readerMember = await c.memberService.register(
      { name: "Reader", email: "reader@bookstore.local", membershipType: type._id, homeBranch: main._id, userEmail: reader ? "reader@bookstore.local" : "" },
      actor
    );
    const sara = await c.memberService.register({ name: "Sara Ahmed", kind: "student", institution: "Cairo University", email: "sara@example.com", membershipType: student._id, homeBranch: main._id }, actor);
    const omar = await c.memberService.register({ name: "Omar Hassan", email: "omar@example.com", membershipType: type._id, homeBranch: east._id }, actor);

    const lend = (copy, member) => c.circulationService.checkout({ barcode: copy.barcode, member: String(member._id) }, actor);
    const first = await lend(copies[0], readerMember);
    await lend(copies[3], readerMember);
    const late = await lend(copies[6], sara);
    await c.loanRepository.updateById(late._id, { checkedOutAt: new Date(Date.now() - 30 * DAY), dueAt: new Date(Date.now() - 9 * DAY) });
    // Everyone else's copy of the first title is out: Omar queues for it.
    await lend(copies[1], sara);
    await c.reservationService.placeForMember({ member: omar._id, book: first.book._id, pickupBranch: main._id }, actor);
    await c.fineService.addManual({ member: sara._id, amount: 2500, reason: "Replacement library card" }, actor);

    const room = await c.roomService.create({ branch: main._id, name: "Study room 1", kind: "study", capacity: 4, features: ["whiteboard"] }, actor);
    await c.roomService.create({ branch: main._id, name: "Event hall", kind: "event", capacity: 60 }, actor);
    const start = new Date(Date.now() + 7 * DAY);
    start.setUTCHours(16, 0, 0, 0);
    await c.eventService.create({ branch: main._id, title: "Book club: Dune", description: "Monthly book club.", startAt: start, endAt: new Date(start.getTime() + 2 * 3_600_000), capacity: 20 }, actor);
    await c.roomBookingService.bookForStaff({ room: room._id, member: sara._id, startAt: new Date(start.getTime() - DAY), endAt: new Date(start.getTime() - DAY + 2 * 3_600_000), purpose: "Group study" }, actor);

    const supplier = await c.supplierService.create({ name: "Nile Book Distributors", email: "orders@example.com" }, actor);
    await c.purchaseOrderService.createRequest({ branch: main._id, supplier: supplier._id, lines: [{ book: books[0]._id, quantity: 3, unitCost: 14000 }], notes: "High demand title" }, actor);

    if (admin) await c.userRepository.updateAccess(admin._id, { branches: [main._id, east._id] });
    console.log(`Seeded: 2 branches, ${copies.length} copies, 3 members, 4 loans (1 overdue), 1 reservation, a fine, rooms, an event, a purchase request.`);
  }
} finally {
  await c.database.disconnect();
}
