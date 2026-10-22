import mongoose from "mongoose";
import { after, before } from "node:test";
import { createContainer } from "../../src/container.js";
import { AccessContext } from "../../src/core/access-context.js";
import { ALL_PERMISSIONS } from "../../src/modules/roles/permissions.js";
import { MIGRATIONS } from "../../src/migrations/index.js";

/** Full access, like an Admin at every branch. */
export const ADMIN = new AccessContext({ userId: new mongoose.Types.ObjectId(), userName: "test admin", role: "Admin", permissions: ALL_PERMISSIONS, branchScope: "all" });

export const staffAt = (branchId, permissions = ALL_PERMISSIONS) =>
  new AccessContext({ userId: new mongoose.Types.ObjectId(), userName: "branch staff", role: "Staff", permissions, branchScope: "assigned", branches: [branchId] });

/**
 * A container on a freshly dropped test database with all indexes (the unique
 * indexes are part of what is being tested). `overrides` replace collaborators.
 */
export function useDatabase(overrides = {}) {
  const handle = {};
  before(async () => {
    handle.container = createContainer(undefined, overrides);
    // Mail goes nowhere: notifications are only queued.
    handle.container.mailer.log = () => {};
    await handle.container.database.connect();
    await mongoose.connection.dropDatabase();
    await MIGRATIONS[0].up(handle.container);
  });
  after(async () => {
    await mongoose.connection.dropDatabase();
    await handle.container.database.disconnect();
  });
  return handle;
}

/** Creates a branch, a membership type, a category, a book with `copies` copies and members. */
export async function seedLibrary(c, { copies = 2, members = 2, type = {}, settings = {}, branchCode = "MAIN" } = {}) {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const branch = await c.branchRepository.create({ code: `${branchCode}${suffix}`, name: `Branch ${suffix}` });
  const membershipType = await c.membershipTypeRepository.create({
    code: `T${suffix}`, name: "Test", loanLimit: 2, loanPeriodDays: 14, maxRenewals: 1, reservationLimit: 2, membershipMonths: 12, ...type,
  });
  const category = await c.categoryRepository.create({ name: `cat-${suffix.toLowerCase()}` });
  const book = await c.bookRepository.create({
    bookTitle: `Title ${suffix}`, author: "Test Author", description: "d", price: 0, quantity: 0, category: category._id,
  });
  const copyList = copies ? await c.copyService.addCopies({ book: book._id, branch: branch._id, count: copies, condition: "good", cost: 5000 }, ADMIN) : [];
  const memberList = [];
  for (let index = 0; index < members; index += 1) {
    memberList.push(await c.memberService.register({ name: `Member ${index}`, email: `m${index}-${suffix}@example.com`, membershipType: membershipType._id, homeBranch: branch._id }, ADMIN));
  }
  if (Object.keys(settings).length) {
    const current = await c.settingsService.get();
    const { version, ...values } = current;
    await c.settingsService.update({ ...deepMerge(values, settings), version }, ADMIN);
  }
  return { branch, membershipType, category, book, copies: copyList, members: memberList };
}

const deepMerge = (base, extra) =>
  Object.fromEntries(
    [...new Set([...Object.keys(base), ...Object.keys(extra)])].map((key) => [
      key,
      extra[key] && typeof extra[key] === "object" && !Array.isArray(extra[key]) ? deepMerge(base[key] ?? {}, extra[key]) : extra[key] ?? base[key],
    ])
  );

/** Moves a loan's due date (to simulate time passing). */
export const setDueDate = (c, loanId, dueAt) => c.loanRepository.updateById(loanId, { dueAt });

export const DAY = 24 * 60 * 60 * 1000;
