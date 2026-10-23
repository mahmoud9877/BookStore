// Coupon claims and the shop's sale prices on a real MongoDB replica set.
import mongoose from "mongoose";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ADMIN, DAY, useDatabase } from "./harness.js";

const db = useDatabase();

describe("coupons", () => {
  test("codes are unique regardless of case", async () => {
    const c = db.container;
    await c.couponService.create({ code: "UNIQUE1", type: "fixed", value: 5 }, ADMIN);
    await assert.rejects(c.couponService.create({ code: "unique1", type: "fixed", value: 5 }, ADMIN), {
      status: 409,
      message: "A coupon with this code already exists",
    });
  });

  test("claims stop at maxUses, skip inactive or expired coupons, and release gives a use back", async () => {
    const c = db.container;
    const limited = await c.couponRepository.create({ code: "TWICE", type: "percent", value: 10, maxUses: 2 });
    assert.ok(await c.couponRepository.claim(limited._id));
    assert.ok(await c.couponRepository.claim(limited._id));
    assert.equal(await c.couponRepository.claim(limited._id), null);
    await c.couponRepository.release("twice");
    assert.equal((await c.couponRepository.findByCode("twice")).usedCount, 1);
    assert.ok(await c.couponRepository.claim(limited._id));

    const unlimited = await c.couponRepository.create({ code: "OPEN", type: "fixed", value: 1 });
    for (let i = 0; i < 3; i += 1) assert.ok(await c.couponRepository.claim(unlimited._id));

    const inactive = await c.couponRepository.create({ code: "OFF", type: "fixed", value: 1, isActive: false });
    assert.equal(await c.couponRepository.claim(inactive._id), null);
    const expired = await c.couponRepository.create({ code: "OLD", type: "fixed", value: 1, expiresAt: new Date(Date.now() - DAY) });
    assert.equal(await c.couponRepository.claim(expired._id), null);
    const future = await c.couponRepository.create({ code: "LATER", type: "fixed", value: 1, expiresAt: new Date(Date.now() + DAY) });
    assert.ok(await c.couponRepository.claim(future._id));

    const unused = await c.couponRepository.create({ code: "ZERO", type: "fixed", value: 1 });
    await c.couponRepository.release(unused.code);
    assert.equal((await c.couponRepository.findById(unused._id)).usedCount, 0, "never below zero");
  });

  test("a cash order with a coupon uses sale prices and claims the coupon; cancelling releases it", async () => {
    const c = db.container;
    const userId = new mongoose.Types.ObjectId(); // carts and orders only reference the user
    const category = await c.categoryRepository.create({ name: `coupons-${Date.now()}` });
    const book = await c.bookRepository.create({
      bookTitle: "On sale", author: "A", description: "d", image: "https://img.example/c.png", price: 200, quantity: 5, category: category._id, discountPercent: 25,
    });
    await c.couponRepository.create({ code: "TAKE20", type: "fixed", value: 20, minOrder: 100, maxUses: 1 });
    await c.cartService.addItem(userId, { bookId: String(book._id), quantity: 2 });

    const cart = await c.cartService.getCart(userId);
    assert.deepEqual([cart.books[0].price, cart.books[0].originalPrice], [150, 200]);
    const check = await c.couponService.check(userId, "take20");
    assert.deepEqual({ ...check }, { code: "TAKE20", type: "fixed", value: 20, subtotal: 300, discount: 20, total: 280 });

    const { order } = await c.orderService.placeOrder({ _id: userId, email: "b@example.com" }, {
      address: "1 Nile St", phone: ["+201012345678"], paymentType: "cash", couponCode: "take20",
    });
    assert.deepEqual([order.subtotal, order.discount, order.finalPrice], [300, 20, 280]);
    assert.deepEqual(order.coupon, { code: "TAKE20", discount: 20 });
    assert.equal((await c.couponRepository.findByCode("TAKE20")).usedCount, 1);

    await c.orderService.cancelOrder({ orderId: order._id, reason: "changed my mind" }, userId);
    assert.equal((await c.couponRepository.findByCode("TAKE20")).usedCount, 0);
  });
});
