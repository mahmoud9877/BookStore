import mongoose from "mongoose";
import { couponModel } from "../modules/coupons/coupon.model.js";
import { linkLegacyBookCategories } from "../modules/books/link-legacy-categories.js";
import { workKeyOf } from "../modules/books/book.model.js";
import { DEFAULT_STAFF_ROLES } from "../modules/roles/permissions.js";
import { findSystemRole } from "../modules/roles/system-roles.js";

/**
 * Ordered, idempotent migrations (`npm run migrate`). They only add data or
 * indexes; none deletes collections, fields or existing records.
 * `context` is the application container.
 */
export const MIGRATIONS = [
  {
    id: "2026-10-22-01-create-indexes",
    description: "Create every index declared by the models (unique keys, active-loan guard, search)",
    async up() {
      const created = [];
      for (const model of Object.values(mongoose.models)) {
        await model.createIndexes();
        created.push(model.modelName);
      }
      return { models: created.length };
    },
  },
  {
    id: "2026-10-22-02-link-book-categories",
    description: "Books that store a category name reference the category by id",
    async up(context) {
      return { linked: await linkLegacyBookCategories(context) };
    },
  },
  {
    id: "2026-10-22-03-book-authors-and-editions",
    description: "Create author records from books' author text; set authors and the edition grouping key",
    async up({ bookRepository, authorRepository }) {
      let updated = 0;
      for await (const book of bookRepository.cursor({ $or: [{ authors: { $exists: false } }, { authors: { $size: 0 } }, { workKey: { $exists: false } }] })) {
        const names = String(book.author ?? "").split(",").map((name) => name.trim()).filter(Boolean);
        const authors = names.length ? await authorRepository.findOrCreateByNames(names) : [];
        await bookRepository.updateWhere(
          { _id: book._id },
          { $set: { authors: authors.map((author) => author._id), workKey: workKeyOf(book.bookTitle, book.author ?? "") } }
        );
        updated += 1;
      }
      // Existing shop titles stay for sale; the flag only matters for new records.
      const forSale = await bookRepository.updateMany({ isForSale: { $exists: false } }, { $set: { isForSale: true } });
      return { updated, markedForSale: forSale };
    },
  },
  {
    id: "2026-10-22-04-default-branch",
    description: "Create a first branch when none exists (rename it in Dashboard → Branches)",
    async up({ branchRepository }) {
      if (await branchRepository.countWhere({})) return { created: false };
      await branchRepository.create({ code: "MAIN", name: "Main Library" });
      return { created: true };
    },
  },
  {
    id: "2026-10-22-05-default-membership-type",
    description: "Create a starting membership type when none exists (edit its limits in Dashboard → Settings)",
    async up({ membershipTypeRepository }) {
      if (await membershipTypeRepository.countWhere({})) return { created: false };
      // Placeholder limits so circulation works out of the box; a library sets its own.
      await membershipTypeRepository.create({
        code: "STANDARD",
        name: "Standard",
        description: "Starting values — review and adjust to the library's policy.",
        loanLimit: 5,
        loanPeriodDays: 14,
        maxRenewals: 2,
        reservationLimit: 5,
        membershipMonths: 12,
      });
      return { created: true };
    },
  },
  {
    id: "2026-10-22-06-default-staff-roles",
    description: "Create the starting staff roles (Librarian, Branch Manager, Inventory Staff, Finance Staff) if missing",
    async up({ roleRepository }) {
      const created = [];
      for (const role of DEFAULT_STAFF_ROLES) {
        if (findSystemRole(role.name) || (await roleRepository.findByName(role.name))) continue;
        await roleRepository.create(role);
        created.push(role.name);
      }
      return { created };
    },
  },
  {
    id: "2026-10-23-01-coupon-indexes",
    description: "Create the coupons collection's indexes (unique code)",
    async up() {
      // Production does not auto-create indexes, and the first index migration ran before coupons existed.
      await couponModel.createIndexes();
      return { created: true };
    },
  },
];
