import Stripe from "stripe";
import { Types } from "mongoose";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import cartModel from "../src/modules/cart/cart.model.js";
import bookModel from "../src/modules/books/book.model.js";
import orderModel from "../src/modules/orders/order.model.js";
import { authenticateAs, makeUser, startServer } from "./helpers.js";

let server;
before(async () => {
  server = await startServer();
});
after(() => server.close());

describe("cart", () => {
  test("DELETE /cart/clear empties the cart (route previously had no handler)", async (t) => {
    const user = makeUser();
    const headers = authenticateAs(t, user);
    let update;
    t.mock.method(cartModel, "findOneAndUpdate", async (filter, change) => {
      update = { filter, change };
      return { userId: user._id, books: [] };
    });
    const res = await server.request("DELETE", "/cart/clear", { headers });
    assert.equal(res.status, 200);
    assert.deepEqual(update.change, { $set: { books: [] } });
    assert.equal(String(update.filter.userId), String(user._id));
  });

  test("POST /cart/add enforces available stock", async (t) => {
    const headers = authenticateAs(t, makeUser());
    t.mock.method(bookModel, "findById", async () => ({ quantity: 1, price: 10 }));
    const res = await server.request("POST", "/cart/add", {
      headers,
      body: { bookId: new Types.ObjectId().toString(), quantity: 2 },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.message, "Insufficient stock available");
  });
});

describe("orders", () => {
  const cartWith = (...items) => ({ books: items });
  const item = (quantity) => ({
    bookId: new Types.ObjectId(),
    bookTitle: "a book",
    quantity,
  });

  test("regular users can place cash orders; stock is decremented and the cart cleared", async (t) => {
    const user = makeUser("User");
    const headers = authenticateAs(t, user);
    t.mock.method(cartModel, "findOne", async () => cartWith(item(2), item(1)));
    const stockUpdates = [];
    t.mock.method(bookModel, "findOneAndUpdate", async (filter, change) => {
      stockUpdates.push({ filter, change });
      return { _id: filter._id, bookTitle: "a book", price: 50 };
    });
    let createdOrder;
    t.mock.method(orderModel, "create", async (doc) => (createdOrder = doc));
    const clearCart = t.mock.method(cartModel, "updateOne", async () => ({}));

    const res = await server.request("POST", "/order", {
      headers,
      body: { address: "1 Nile St", phone: "01012345678", paymentType: "cash" },
    });

    assert.equal(res.status, 201);
    assert.equal(createdOrder.subtotal, 150);
    assert.equal(createdOrder.status, "placed");
    assert.deepEqual(stockUpdates[0].filter.quantity, { $gte: 2 });
    assert.deepEqual(stockUpdates[0].change, { $inc: { quantity: -2 } });
    assert.equal(clearCart.mock.callCount(), 1);
  });

  test("an out-of-stock item fails the order and releases already reserved stock", async (t) => {
    const headers = authenticateAs(t, makeUser());
    const first = item(2);
    t.mock.method(cartModel, "findOne", async () => cartWith(first, item(5)));
    let call = 0;
    t.mock.method(bookModel, "findOneAndUpdate", async (filter) =>
      call++ === 0 ? { _id: filter._id, price: 10 } : null
    );
    const restored = [];
    t.mock.method(bookModel, "updateOne", async (filter, change) => {
      restored.push({ filter, change });
    });
    const create = t.mock.method(orderModel, "create", async () => ({}));

    const res = await server.request("POST", "/order", {
      headers,
      body: { address: "1 Nile St", phone: ["01012345678"] },
    });

    assert.equal(res.status, 400);
    assert.match(res.json.message, /out of stock/);
    assert.equal(create.mock.callCount(), 0);
    assert.deepEqual(restored, [{ filter: { _id: first.bookId }, change: { $inc: { quantity: 2 } } }]);
  });

  test("PATCH /order/:id/delivered marks the order delivered (was set to canceled)", async (t) => {
    const admin = makeUser("Admin");
    const headers = authenticateAs(t, admin);
    const order = { status: "placed", save: async () => {} };
    t.mock.method(orderModel, "findById", async () => order);

    const res = await server.request("PATCH", `/order/${new Types.ObjectId()}/delivered`, { headers });

    assert.equal(res.status, 200);
    assert.equal(order.status, "delivered");
    assert.equal(order.updatedBy, admin._id);
  });

  test("only admins can mark orders delivered", async (t) => {
    const headers = authenticateAs(t, makeUser("User"));
    const res = await server.request("PATCH", `/order/${new Types.ObjectId()}/delivered`, { headers });
    assert.equal(res.status, 403);
  });
});

describe("stripe webhook", () => {
  const sign = (payload) =>
    Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

  test("rejects payloads with an invalid signature", async () => {
    const res = await server.request("POST", "/order/webhook", {
      raw: "{}",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bad" },
    });
    assert.equal(res.status, 400);
    assert.match(res.text, /Webhook Error/);
  });

  test("verifies the raw body and marks the order placed on checkout completion", async (t) => {
    const orderId = new Types.ObjectId().toString();
    const payload = JSON.stringify({
      id: "evt_test",
      object: "event",
      type: "checkout.session.completed",
      data: { object: { metadata: { orderId } } },
    });
    const update = t.mock.method(orderModel, "updateOne", async () => ({}));

    const res = await server.request("POST", "/order/webhook", {
      raw: payload,
      headers: { "content-type": "application/json", "stripe-signature": sign(payload) },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(update.mock.calls[0].arguments, [{ _id: orderId }, { status: "placed" }]);
  });

  test("an expired checkout rejects the unpaid order and releases its stock", async (t) => {
    const orderId = new Types.ObjectId().toString();
    const bookId = new Types.ObjectId();
    const payload = JSON.stringify({
      id: "evt_test",
      object: "event",
      type: "checkout.session.expired",
      data: { object: { metadata: { orderId } } },
    });
    let filter;
    t.mock.method(orderModel, "findOneAndUpdate", async (query) => {
      filter = query;
      return { books: [{ bookId, quantity: 3 }] };
    });
    const restock = t.mock.method(bookModel, "updateOne", async () => ({}));

    const res = await server.request("POST", "/order/webhook", {
      raw: payload,
      headers: { "content-type": "application/json", "stripe-signature": sign(payload) },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(filter, { _id: orderId, status: "waitPayment" });
    assert.deepEqual(restock.mock.calls[0].arguments, [{ _id: bookId }, { $inc: { quantity: 3 } }]);
  });

  test("ignores events that carry no order id", async (t) => {
    const payload = JSON.stringify({
      id: "evt_test",
      object: "event",
      type: "payment_intent.created",
      data: { object: { metadata: {} } },
    });
    const update = t.mock.method(orderModel, "updateOne", async () => ({}));
    const res = await server.request("POST", "/order/webhook", {
      raw: payload,
      headers: { "content-type": "application/json", "stripe-signature": sign(payload) },
    });
    assert.equal(res.status, 200);
    assert.equal(update.mock.callCount(), 0);
  });
});
