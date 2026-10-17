import Stripe from "stripe";
import { Types } from "mongoose";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { authenticateAs, makeUser, useTestServer } from "./helpers.js";

const server = useTestServer();

/** POST /order with `body` as the authenticated user. */
const postOrder = (headers, body) => server.request("POST", "/order", { headers, body });

/** A Stripe checkout event for `orderId`. */
const checkoutEvent = (type, orderId) => ({ type, data: { object: { metadata: { orderId } } } });

describe("cart", () => {
  test("DELETE /cart/clear empties the cart (route previously had no handler)", async (t) => {
    const user = makeUser();
    const headers = authenticateAs(t, server.container, user);
    const clear = t.mock.method(server.container.cartRepository, "clearByUserId", async () => ({
      userId: user._id,
      books: [],
    }));
    const res = await server.request("DELETE", "/cart/clear", { headers });
    assert.equal(res.status, 200);
    assert.equal(String(clear.mock.calls[0].arguments[0]), String(user._id));
  });

  test("POST /cart/add enforces available stock", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser());
    t.mock.method(server.container.bookRepository, "findById", async () => ({ quantity: 1, price: 10 }));
    const res = await server.request("POST", "/cart/add", {
      headers,
      body: { bookId: new Types.ObjectId().toString(), quantity: 2 },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.message, "Insufficient stock available");
  });

  test("POST /cart/add creates the cart on the first item (201 newCart)", async (t) => {
    const user = makeUser();
    const headers = authenticateAs(t, server.container, user);
    const bookId = new Types.ObjectId().toString();
    t.mock.method(server.container.bookRepository, "findById", async () => ({ quantity: 5, price: 10, bookTitle: "b" }));
    t.mock.method(server.container.cartRepository, "findByUserId", async () => null);
    t.mock.method(server.container.cartRepository, "createForUser", async (userId, items) => ({ userId, books: items }));
    const res = await server.request("POST", "/cart/add", { headers, body: { bookId, quantity: 2 } });
    assert.equal(res.status, 201);
    assert.equal(res.json.message, "Cart created");
    assert.equal(res.json.newCart.books[0].quantity, 2);
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
    const headers = authenticateAs(t, server.container, user);
    const first = item(2);
    t.mock.method(server.container.cartRepository, "findByUserId", async () => cartWith(first, item(1)));
    const reserve = t.mock.method(server.container.bookRepository, "reserveStock", async (items) => ({
      reserved: items.map(({ bookId, quantity }) => ({
        book: { _id: bookId, bookTitle: "a book", price: 50 },
        quantity,
      })),
    }));
    let createdOrder;
    t.mock.method(server.container.orderRepository, "create", async (doc) => (createdOrder = doc));
    const clearCart = t.mock.method(server.container.cartRepository, "clearByUserId", async () => ({}));

    const res = await postOrder(headers, { address: "1 Nile St", phone: "01012345678", paymentType: "cash" });

    assert.equal(res.status, 201);
    assert.equal(res.json.message, "Order created successfully");
    assert.equal(createdOrder.subtotal, 150);
    assert.equal(createdOrder.status, "placed");
    const [requested] = reserve.mock.calls[0].arguments;
    assert.deepEqual([requested[0].bookId, requested[0].quantity], [first.bookId, 2]);
    assert.equal(clearCart.mock.callCount(), 1);
  });

  test("an out-of-stock item fails the order before anything is written", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser());
    const unavailable = item(5);
    t.mock.method(server.container.cartRepository, "findByUserId", async () => cartWith(item(2), unavailable));
    t.mock.method(server.container.bookRepository, "reserveStock", async () => ({ unavailable }));
    const create = t.mock.method(server.container.orderRepository, "create", async () => ({}));
    const clearCart = t.mock.method(server.container.cartRepository, "clearByUserId", async () => ({}));

    const res = await postOrder(headers, { address: "1 Nile St", phone: ["01012345678"] });

    assert.equal(res.status, 400);
    assert.match(res.json.message, /out of stock/);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(clearCart.mock.callCount(), 0);
  });

  test("PATCH /order/:id/delivered marks the order delivered (was set to canceled)", async (t) => {
    const admin = makeUser("Admin");
    const headers = authenticateAs(t, server.container, admin);
    t.mock.method(server.container.orderRepository, "findById", async () => ({ status: "placed" }));
    const update = t.mock.method(server.container.orderRepository, "updateStatus", async (id, status) => ({ status }));
    const orderId = new Types.ObjectId().toString();

    const res = await server.request("PATCH", `/order/${orderId}/delivered`, { headers });

    assert.equal(res.status, 200);
    assert.equal(res.json.order.status, "delivered");
    const [id, status, fields] = update.mock.calls[0].arguments;
    assert.equal(id, orderId);
    assert.equal(status, "delivered");
    assert.equal(String(fields.updatedBy), String(admin._id));
  });

  test("only admins can mark orders delivered", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("User"));
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
  const postEvent = (event) => {
    const payload = JSON.stringify({ id: "evt_test", object: "event", ...event });
    return server.request("POST", "/order/webhook", {
      raw: payload,
      headers: { "content-type": "application/json", "stripe-signature": sign(payload) },
    });
  };

  test("rejects payloads with an invalid signature", async () => {
    const res = await server.request("POST", "/order/webhook", {
      raw: "{}",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bad" },
    });
    assert.equal(res.status, 400);
    assert.match(res.json.message, /^Webhook Error/);
  });

  test("verifies the raw body and marks the order placed on checkout completion", async (t) => {
    const orderId = new Types.ObjectId().toString();
    const update = t.mock.method(server.container.orderRepository, "updateStatus", async () => ({}));

    const res = await postEvent(checkoutEvent("checkout.session.completed", orderId));

    assert.equal(res.status, 200);
    assert.deepEqual(update.mock.calls[0].arguments, [orderId, "placed"]);
  });

  test("an expired checkout rejects the unpaid order and releases its stock", async (t) => {
    const orderId = new Types.ObjectId().toString();
    const bookId = new Types.ObjectId();
    const reject = t.mock.method(server.container.orderRepository, "rejectIfAwaitingPayment", async () => ({
      books: [{ bookId, quantity: 3 }],
    }));
    const release = t.mock.method(server.container.bookRepository, "releaseStock", async () => {});

    const res = await postEvent(checkoutEvent("checkout.session.expired", orderId));

    assert.equal(res.status, 200);
    assert.deepEqual(reject.mock.calls[0].arguments, [orderId]);
    assert.deepEqual(release.mock.calls[0].arguments, [[{ bookId, quantity: 3 }]]);
  });

  test("ignores events that carry no order id", async (t) => {
    const update = t.mock.method(server.container.orderRepository, "updateStatus", async () => ({}));
    const res = await postEvent(checkoutEvent("payment_intent.created", undefined));
    assert.equal(res.status, 200);
    assert.equal(res.json.message, "Ignored");
    assert.equal(update.mock.callCount(), 0);
  });
});
