// Repository tests: each repository receives a fake Mongoose model, so the
// queries it issues (filters, atomic operators, lean results) can be checked
// without a database.
import { Types } from "mongoose";
import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { BaseRepository } from "../src/core/base-repository.js";
import { CartRepository } from "../src/modules/cart/cart.repository.js";
import { BookRepository } from "../src/modules/books/book.repository.js";

/** A query stand-in: chainable, and `.lean()` resolves `result`. */
const query = (result) => {
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    select: () => chain,
    lean: mock.fn(async () => result),
  };
  return chain;
};

describe("BaseRepository", () => {
  test("returns plain objects, never Mongoose documents", async () => {
    const document = { toObject: () => ({ _id: "1", name: "plain" }), save: () => {} };
    const findQuery = query({ _id: "1" });
    const model = {
      findById: mock.fn(() => findQuery),
      create: mock.fn(async () => document),
    };
    const repository = new BaseRepository(model);

    assert.deepEqual(await repository.findById("1"), { _id: "1" });
    assert.equal(findQuery.lean.mock.callCount(), 1);
    const created = await repository.create({ name: "plain" });
    assert.deepEqual(created, { _id: "1", name: "plain" });
    assert.equal("save" in created, false);
  });

  test("has no generic save: writes go through intention-revealing methods", () => {
    assert.equal("save" in BaseRepository.prototype, false);
  });
});

describe("BookRepository.reserveStock", () => {
  const items = [
    { bookId: new Types.ObjectId(), quantity: 2 },
    { bookId: new Types.ObjectId(), quantity: 5 },
  ];

  test("decrements each book only when enough copies are in stock", async () => {
    const model = {
      findOneAndUpdate: mock.fn((filter) => query({ _id: filter._id, price: 10 })),
      bulkWrite: mock.fn(async () => {}),
    };
    const result = await new BookRepository(model).reserveStock(items);

    assert.deepEqual(
      result.reserved.map(({ book, quantity }) => [book._id, quantity]),
      items.map(({ bookId, quantity }) => [bookId, quantity])
    );
    const [filter, update] = model.findOneAndUpdate.mock.calls[0].arguments;
    assert.deepEqual(filter, { _id: items[0].bookId, quantity: { $gte: 2 } });
    assert.deepEqual(update, { $inc: { quantity: -2 } });
    assert.equal(model.bulkWrite.mock.callCount(), 0);
  });

  test("is all-or-nothing: puts back what it took when a later book is short", async () => {
    let call = 0;
    const model = {
      findOneAndUpdate: mock.fn((filter) => query(call++ === 0 ? { _id: filter._id } : null)),
      bulkWrite: mock.fn(async () => {}),
    };
    const result = await new BookRepository(model).reserveStock(items);

    assert.deepEqual(result, { unavailable: items[1] });
    assert.deepEqual(model.bulkWrite.mock.calls[0].arguments[0], [
      { updateOne: { filter: { _id: items[0].bookId }, update: { $inc: { quantity: 2 } } } },
    ]);
  });

  test("releaseStock restocks in one bulk write and skips empty lists", async () => {
    const model = { bulkWrite: mock.fn(async () => {}) };
    const repository = new BookRepository(model);
    await repository.releaseStock([]);
    assert.equal(model.bulkWrite.mock.callCount(), 0);
    await repository.releaseStock(items);
    assert.equal(model.bulkWrite.mock.calls[0].arguments[0].length, 2);
  });
});

describe("CartRepository", () => {
  const userId = new Types.ObjectId();
  const bookId = new Types.ObjectId();
  const modelReturning = (result) => ({ findOneAndUpdate: mock.fn(() => query(result)) });

  test("incrementItemQuantity updates the matching line item atomically", async () => {
    const model = modelReturning({ books: [] });
    await new CartRepository(model).incrementItemQuantity(userId, bookId, 2);
    const [filter, update, options] = model.findOneAndUpdate.mock.calls[0].arguments;
    assert.deepEqual(filter, { userId, "books.bookId": bookId });
    assert.deepEqual(update, { $inc: { "books.$.quantity": 2 } });
    assert.equal(options.new, true);
  });

  test("addItem pushes with schema validation", async () => {
    const model = modelReturning({ books: [] });
    const item = { bookId, quantity: 1, price: 5, image: "i" };
    await new CartRepository(model).addItem(userId, item);
    const [filter, update, options] = model.findOneAndUpdate.mock.calls[0].arguments;
    assert.deepEqual(filter, { userId });
    assert.deepEqual(update, { $push: { books: item } });
    assert.equal(options.runValidators, true);
  });

  test("removeItem pulls the line item and resolves null when it is absent", async () => {
    const model = modelReturning(null);
    assert.equal(await new CartRepository(model).removeItem(userId, bookId), null);
    const [filter, update] = model.findOneAndUpdate.mock.calls[0].arguments;
    assert.deepEqual(filter, { userId, "books.bookId": bookId });
    assert.deepEqual(update, { $pull: { books: { bookId } } });
  });
});
