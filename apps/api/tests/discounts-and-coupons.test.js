// Book discounts (sale price), coupons (check maths, errors, claims) and how
// orders and the Stripe gateway apply them. Collaborators are fakes; no database.
import { Types } from "mongoose";
import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { HttpError } from "../src/core/http-errors.js";
import { activeDiscountPercent, isDiscountActive, round2, salePriceOf } from "../src/modules/books/utils/book-pricing.js";
import { BookResponseDto, CreateBookDto, UpdateBookDto } from "../src/modules/books/dtos/book.dto.js";
import { CartService } from "../src/modules/cart/services/cart.service.js";
import { CouponService } from "../src/modules/coupons/services/coupon.service.js";
import { CouponDtos, CouponResponseDto } from "../src/modules/coupons/dtos/coupon.dto.js";
import { couponDiscount, couponProblem } from "../src/modules/coupons/policies/coupon-rules.js";
import { OrderService } from "../src/modules/orders/services/order.service.js";
import { CreateOrderDto, OrderResponseDto } from "../src/modules/orders/dtos/order.dto.js";
import { StripePaymentGateway } from "../src/infrastructure/stripe-payment-gateway.js";
import { PAYMENT_OUTCOMES } from "../src/modules/orders/providers/payment-gateway.js";
import { authenticateAs, makeUser, useTestServer } from "./helpers.js";

const DAY = 24 * 60 * 60 * 1000;
const tomorrow = () => new Date(Date.now() + DAY);
const yesterday = () => new Date(Date.now() - DAY);

function fake(methods) {
  return Object.fromEntries(
    Object.entries(methods).map(([name, impl]) => [name, mock.fn(typeof impl === "function" ? impl : async () => impl)])
  );
}

async function rejectsWith(promise, status, message) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof HttpError, `expected an HttpError, got ${error}`);
    assert.equal(error.status, status);
    if (message !== undefined) assert.equal(error.message, message);
    return true;
  });
}

const coupon = (attributes = {}) => ({
  _id: new Types.ObjectId(),
  code: "SAVE10",
  type: "percent",
  value: 10,
  minOrder: 0,
  expiresAt: null,
  maxUses: null,
  usedCount: 0,
  isActive: true,
  ...attributes,
});

describe("sale price rule", () => {
  test("an active discount lowers the price, rounded to 2 decimals", () => {
    const book = { price: 99.99, discountPercent: 15, discountEndsAt: tomorrow() };
    assert.equal(isDiscountActive(book), true);
    assert.equal(activeDiscountPercent(book), 15);
    assert.equal(salePriceOf(book), 84.99);
    assert.equal(salePriceOf({ price: 320, discountPercent: 25, discountEndsAt: null }), 240);
  });

  test("an expired discount, a zero discount or no discount fields mean the list price", () => {
    for (const book of [
      { price: 50, discountPercent: 20, discountEndsAt: yesterday() },
      { price: 50, discountPercent: 0, discountEndsAt: null },
      { price: 50 },
    ]) {
      assert.equal(isDiscountActive(book), false);
      assert.equal(activeDiscountPercent(book), 0);
      assert.equal(salePriceOf(book), 50);
    }
  });

  test("a discount ending exactly now is over", () => {
    const now = new Date();
    assert.equal(isDiscountActive({ price: 10, discountPercent: 10, discountEndsAt: now }, now), false);
  });

  test("book responses carry the raw discount and the derived sale price", () => {
    const active = BookResponseDto.from({ _id: "b", price: 200, discountPercent: 10, discountEndsAt: null });
    assert.deepEqual(
      [active.discountPercent, active.discountEndsAt, active.salePrice, active.activeDiscountPercent],
      [10, null, 180, 10]
    );
    const ends = yesterday();
    const expired = BookResponseDto.from({ _id: "b", price: 200, discountPercent: 10, discountEndsAt: ends });
    assert.deepEqual([expired.discountEndsAt, expired.salePrice, expired.activeDiscountPercent], [ends, 200, 0]);
    const legacy = BookResponseDto.from({ _id: "b", price: 200 });
    assert.deepEqual([legacy.discountPercent, legacy.discountEndsAt, legacy.salePrice, legacy.activeDiscountPercent], [0, null, 200, 0]);
  });

  test("book requests accept a discount and clear its end date with an empty string", () => {
    const input = { bookTitle: "t", author: "a", description: "d", category: new Types.ObjectId().toString() };
    const withDiscount = CreateBookDto.parse({ ...input, discountPercent: "20", discountEndsAt: "2030-01-31" }).dto.toAttributes();
    assert.equal(withDiscount.discountPercent, 20);
    assert.ok(withDiscount.discountEndsAt instanceof Date);
    assert.equal(CreateBookDto.parse({ ...input, discountEndsAt: "" }).dto.toAttributes().discountEndsAt, null);
    assert.equal(CreateBookDto.parse({ ...input, discountEndsAt: null }).dto.toAttributes().discountEndsAt, null);

    const untouched = UpdateBookDto.parse({ ...input, id: new Types.ObjectId().toString() }).dto.toAttributes();
    assert.equal("discountPercent" in untouched, false, "an update without discount fields keeps the stored discount");
    assert.equal("discountEndsAt" in untouched, false);

    for (const discountPercent of [91, -1, 2.5]) {
      assert.ok(CreateBookDto.parse({ ...input, discountPercent }).error, String(discountPercent));
    }
  });
});

describe("cart prices", () => {
  test("cart lines show the current sale price and the list price", async () => {
    const onSale = new Types.ObjectId();
    const regular = new Types.ObjectId();
    const gone = new Types.ObjectId();
    const bookRepository = fake({
      findPricing: [
        { _id: onSale, price: 100, discountPercent: 30, discountEndsAt: null },
        { _id: regular, price: 40 },
      ],
    });
    const cartRepository = fake({
      findByUserId: {
        books: [
          { bookId: onSale, bookTitle: "a", image: "i", price: 100, quantity: 2 },
          { bookId: regular, bookTitle: "b", image: "i", price: 35, quantity: 1 },
          { bookId: gone, bookTitle: "c", image: "i", price: 9, quantity: 1 },
        ],
      },
    });
    const service = new CartService({ cartRepository, bookRepository });

    const cart = await service.getCart("u");
    assert.deepEqual(
      cart.books.map(({ price, originalPrice }) => [price, originalPrice]),
      [[70, 100], [40, 40], [9, 9]]
    );
    assert.deepEqual(bookRepository.findPricing.mock.calls[0].arguments[0], [String(onSale), String(regular), String(gone)]);

    const { subtotal } = await service.pricedCart("u");
    assert.equal(subtotal, 189);
  });
});

describe("coupon rules", () => {
  test("percent and fixed discounts", () => {
    assert.equal(couponDiscount(coupon({ type: "percent", value: 15 }), 333.33), 50);
    assert.equal(couponDiscount(coupon({ type: "percent", value: 100 }), 80), 80);
    assert.equal(couponDiscount(coupon({ type: "fixed", value: 25 }), 80), 25);
    assert.equal(couponDiscount(coupon({ type: "fixed", value: 500 }), 80), 80, "never more than the subtotal");
  });

  test("each problem has its own message, checked in order", () => {
    assert.equal(couponProblem(null, 100), "Coupon not found");
    assert.equal(couponProblem(coupon({ isActive: false }), 100), "This coupon is no longer active");
    assert.equal(couponProblem(coupon({ expiresAt: yesterday() }), 100), "This coupon has expired");
    assert.equal(couponProblem(coupon({ maxUses: 3, usedCount: 3 }), 100), "This coupon has reached its usage limit");
    assert.equal(couponProblem(coupon({ minOrder: 150 }), 100), "Spend at least 150 to use this coupon");
    assert.equal(couponProblem(coupon({ expiresAt: tomorrow(), maxUses: 3, usedCount: 2, minOrder: 100 }), 100), null);
  });

  test("coupon requests store the code upper-case and validate its shape", () => {
    const { dto } = CouponDtos.Create.parse({ code: "  summer_24 ", type: "fixed", value: 20, usedCount: 99 });
    assert.equal(dto.code, "SUMMER_24");
    assert.equal(dto.usedCount, undefined, "usedCount is server-managed");
    for (const code of ["ab", "has space", "x".repeat(31), "bad!"]) {
      assert.ok(CouponDtos.Create.parse({ code, type: "fixed", value: 1 }).error, code);
    }
    assert.ok(CouponDtos.Create.parse({ code: "OK1", type: "other", value: 1 }).error);
    assert.ok(CouponDtos.Create.parse({ code: "OK1", type: "fixed", value: 0 }).error);
    assert.equal(CouponDtos.Create.parse({ code: "OK1", type: "fixed", value: 5, maxUses: "", expiresAt: "" }).error, undefined);
  });

  test("coupon responses expose exactly the contract's fields", () => {
    const json = { ...CouponResponseDto.from({ ...coupon(), createdAt: "c", updatedAt: "u", __v: 0 }) };
    assert.deepEqual(Object.keys(json), ["_id", "code", "type", "value", "minOrder", "expiresAt", "maxUses", "usedCount", "isActive", "createdAt"]);
  });
});

describe("CouponService", () => {
  const serviceWith = ({ found = coupon(), items = [{ price: 50, quantity: 2 }], subtotal = 100 } = {}) => {
    const couponRepository = fake({ findByCode: found });
    const cartService = fake({ pricedCart: { items, subtotal } });
    return { couponRepository, service: new CouponService({ couponRepository, cartService, auditService: fake({ record: undefined }) }) };
  };

  test("check prices the code against the cart", async () => {
    const { service, couponRepository } = serviceWith({ found: coupon({ code: "SAVE10", type: "percent", value: 12.5 }), subtotal: 99.99 });
    const result = await service.check("u", "save10");
    assert.deepEqual({ ...result }, { code: "SAVE10", type: "percent", value: 12.5, subtotal: 99.99, discount: 12.5, total: 87.49 });
    assert.equal(couponRepository.findByCode.mock.calls[0].arguments[0], "save10");

    const fixed = await serviceWith({ found: coupon({ type: "fixed", value: 30 }), subtotal: 100 }).service.check("u", "x");
    assert.deepEqual([fixed.discount, fixed.total], [30, 70]);
  });

  test("check refuses an empty cart and every unusable coupon with 400", async () => {
    await rejectsWith(serviceWith({ items: [], subtotal: 0 }).service.check("u", "SAVE10"), 400, "Empty Cart");
    const cases = [
      [null, "Coupon not found"],
      [coupon({ isActive: false }), "This coupon is no longer active"],
      [coupon({ expiresAt: yesterday() }), "This coupon has expired"],
      [coupon({ maxUses: 1, usedCount: 1 }), "This coupon has reached its usage limit"],
      [coupon({ minOrder: 250 }), "Spend at least 250 to use this coupon"],
    ];
    for (const [found, message] of cases) {
      await rejectsWith(serviceWith({ found }).service.check("u", "SAVE10"), 400, message);
    }
  });

  test("percentage coupons must be between 1 and 100, also when only the type changes", async () => {
    const { service } = serviceWith();
    await rejectsWith(service.beforeWrite({ type: "percent", value: 150 }, null), 400, "A percentage coupon must be between 1 and 100");
    await rejectsWith(service.beforeWrite({ type: "percent" }, coupon({ type: "fixed", value: 200 })), 400);
    const data = { type: "fixed", value: 150, maxUses: "", expiresAt: "" };
    await service.beforeWrite(data, null);
    assert.deepEqual([data.maxUses, data.expiresAt], [null, null], "empty strings clear the limit and the expiry");
  });
});

describe("orders with discounts and coupons", () => {
  const user = { _id: new Types.ObjectId(), email: "reader@example.com" };
  const bookId = new Types.ObjectId();
  const reserving = (book) =>
    fake({
      reserveStock: async (items) => ({
        reserved: items.map((item) => ({ book: { bookTitle: "dune", ...book, _id: item.bookId }, quantity: item.quantity })),
      }),
      releaseStock: undefined,
    });
  const makeService = (overrides = {}) => {
    const deps = {
      orderRepository: fake({ create: async (doc) => ({ _id: "order-1", ...doc }), updateStatus: {} }),
      cartRepository: fake({ findByUserId: { books: [{ bookId, quantity: 2 }] }, clearByUserId: {} }),
      bookRepository: reserving({ price: 100, discountPercent: 20, discountEndsAt: null }),
      couponRepository: fake({ findByCode: coupon({ code: "SAVE10", value: 10 }), claim: async () => ({}), release: {}, findById: null }),
      paymentGateway: { isConfigured: true, ...fake({ createCheckout: { id: "cs_1", url: "https://pay" } }) },
      ...overrides,
    };
    return { service: new OrderService(deps), ...deps };
  };

  test("lines are priced at the sale price and the coupon discount is stored", async () => {
    const { service, orderRepository, couponRepository } = makeService();
    const { order } = await service.placeOrder(user, { paymentType: "cash", couponCode: "save10" });

    const created = orderRepository.create.mock.calls[0].arguments[0];
    assert.deepEqual([created.books[0].unitPrice, created.books[0].finalPrice], [80, 160]);
    assert.deepEqual([created.subtotal, created.discount, created.finalPrice], [160, 16, 144]);
    assert.deepEqual(created.coupon, { code: "SAVE10", discount: 16 });
    assert.equal(couponRepository.claim.mock.callCount(), 1);
    assert.deepEqual([order.subtotal, order.discount, order.finalPrice], [160, 16, 144]);
    assert.deepEqual(order.coupon, { code: "SAVE10", discount: 16 });
  });

  test("without a coupon the discount is 0 and nothing is claimed", async () => {
    const { service, orderRepository, couponRepository } = makeService();
    const { order } = await service.placeOrder(user, { paymentType: "cash", couponCode: "" });
    const created = orderRepository.create.mock.calls[0].arguments[0];
    assert.deepEqual([created.discount, created.coupon, created.finalPrice], [0, null, 160]);
    assert.equal(couponRepository.findByCode.mock.callCount(), 0);
    assert.deepEqual([order.discount, order.coupon], [0, null]);
  });

  test("an unusable coupon fails before stock is reserved", async () => {
    const { service, bookRepository } = makeService({ couponRepository: fake({ findByCode: coupon({ isActive: false }) }) });
    await rejectsWith(service.placeOrder(user, { couponCode: "SAVE10" }), 400, "This coupon is no longer active");
    assert.equal(bookRepository.reserveStock.mock.callCount(), 0);
  });

  test("a minimum the priced order does not reach releases the reserved stock", async () => {
    const { service, bookRepository, orderRepository } = makeService({
      couponRepository: fake({ findByCode: coupon({ minOrder: 500 }), claim: {} }),
    });
    await rejectsWith(service.placeOrder(user, { couponCode: "SAVE10" }), 400, "Spend at least 500 to use this coupon");
    assert.equal(bookRepository.releaseStock.mock.callCount(), 1);
    assert.equal(orderRepository.create.mock.callCount(), 0);
  });

  test("losing the claim race reports the usage limit and releases the stock", async () => {
    const { service, bookRepository } = makeService({
      couponRepository: fake({ findByCode: coupon({ maxUses: 1 }), claim: null, findById: coupon({ maxUses: 1, usedCount: 1 }) }),
    });
    await rejectsWith(service.placeOrder(user, { couponCode: "SAVE10" }), 400, "This coupon has reached its usage limit");
    assert.equal(bookRepository.releaseStock.mock.callCount(), 1);
  });

  test("the claim is released when the order cannot be saved", async () => {
    const { service, couponRepository } = makeService({
      orderRepository: fake({ create: async () => { throw new Error("write failed"); } }),
    });
    await assert.rejects(service.placeOrder(user, { couponCode: "SAVE10" }), /write failed/);
    assert.deepEqual(couponRepository.release.mock.calls[0].arguments, ["SAVE10"]);
  });

  test("card orders pass the discount to the gateway; a failed checkout releases the claim", async () => {
    const { service, paymentGateway } = makeService();
    await service.placeOrder(user, { paymentType: "card", couponCode: "SAVE10" });
    assert.deepEqual(paymentGateway.createCheckout.mock.calls[0].arguments[0], {
      orderId: "order-1",
      customerEmail: user.email,
      items: [{ name: "dune", unitPrice: 80, quantity: 2 }],
      discount: { amount: 16, name: "SAVE10" },
    });

    mock.method(console, "error", () => {});
    const failing = makeService({
      paymentGateway: { isConfigured: true, ...fake({ createCheckout: async () => { throw new Error("down"); } }) },
    });
    await rejectsWith(failing.service.placeOrder(user, { paymentType: "card", couponCode: "SAVE10" }), 502);
    assert.deepEqual(failing.couponRepository.release.mock.calls[0].arguments, ["SAVE10"]);
    console.error.mock.restore();
  });

  test("a card order the coupon makes free skips Stripe and is placed with nothing to collect", async () => {
    const { service, orderRepository, paymentGateway } = makeService({
      couponRepository: fake({ findByCode: coupon({ code: "FREE", type: "fixed", value: 500 }), claim: async () => ({}), release: {}, findById: null }),
    });
    const { order, session } = await service.placeOrder(user, { paymentType: "card", couponCode: "FREE" });
    const created = orderRepository.create.mock.calls[0].arguments[0];
    assert.deepEqual([created.subtotal, created.discount, created.finalPrice], [160, 160, 0]);
    assert.equal(created.paymentType, "cash");
    assert.equal(order.status, "placed");
    assert.equal(session, null);
    assert.equal(paymentGateway.createCheckout.mock.callCount(), 0);
  });

  test("cancelling or a rejected payment gives the coupon use back", async () => {
    const order = { paymentType: "cash", status: "placed", books: [{ bookId, quantity: 1 }], coupon: { code: "SAVE10", discount: 5 } };
    const cancelled = makeService({ orderRepository: fake({ findByIdForUser: order, updateStatus: { status: "canceled" } }) });
    await cancelled.service.cancelOrder({ orderId: "o", reason: "changed my mind" }, user._id);
    assert.deepEqual(cancelled.couponRepository.release.mock.calls[0].arguments, ["SAVE10"]);

    const rejected = makeService({ orderRepository: fake({ rejectIfAwaitingPayment: order }) });
    await rejected.service.applyPaymentEvent({ outcome: PAYMENT_OUTCOMES.failed, orderId: "o" });
    assert.deepEqual(rejected.couponRepository.release.mock.calls[0].arguments, ["SAVE10"]);

    const noCoupon = makeService({ orderRepository: fake({ rejectIfAwaitingPayment: { ...order, coupon: null } }) });
    await noCoupon.service.applyPaymentEvent({ outcome: PAYMENT_OUTCOMES.failed, orderId: "o" });
    assert.equal(noCoupon.couponRepository.release.mock.callCount(), 0);
  });

  test("order requests accept a coupon code; older orders read as no discount", () => {
    const { dto } = CreateOrderDto.parse({ address: "a", phone: "01012345678", couponCode: " save10 ", couponName: "x" });
    assert.equal(dto.couponCode, "save10");
    assert.equal("couponName" in dto, false);
    const legacy = OrderResponseDto.from({ _id: "o", subtotal: 10, finalPrice: 10, books: [] });
    assert.deepEqual([legacy.discount, legacy.coupon], [0, null]);
  });
});

describe("StripePaymentGateway.createCheckout", () => {
  const stripeClient = () => {
    const client = {
      coupons: { create: mock.fn(async () => ({ id: "co_1" })) },
      checkout: { sessions: { create: mock.fn(async () => ({ id: "cs_1", url: "https://pay" })) } },
    };
    return client;
  };
  const items = [{ name: "dune", unitPrice: 80, quantity: 2 }];

  test("a discount becomes a one-off Stripe coupon on the session", async () => {
    const client = stripeClient();
    const gateway = new StripePaymentGateway({ secretKey: "sk_test_unit", currency: "egp", client });
    await gateway.createCheckout({ orderId: "o1", customerEmail: "a@b.com", items, discount: { amount: 16.5, name: "SAVE10" } });

    assert.deepEqual(client.coupons.create.mock.calls[0].arguments[0], {
      amount_off: 1650,
      currency: "egp",
      duration: "once",
      max_redemptions: 1,
      name: "SAVE10",
    });
    const session = client.checkout.sessions.create.mock.calls[0].arguments[0];
    assert.deepEqual(session.discounts, [{ coupon: "co_1" }]);
    assert.equal(session.line_items[0].price_data.unit_amount, 8000);
  });

  test("without a discount no coupon is created", async () => {
    const client = stripeClient();
    const gateway = new StripePaymentGateway({ secretKey: "sk_test_unit", client });
    await gateway.createCheckout({ orderId: "o1", customerEmail: "a@b.com", items });
    assert.equal(client.coupons.create.mock.callCount(), 0);
    assert.equal(client.checkout.sessions.create.mock.calls[0].arguments[0].discounts, undefined);
  });
});

describe("coupon routes", () => {
  const server = useTestServer();

  test("POST /coupons/check needs only a signed-in user and answers { data }", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("User"));
    t.mock.method(server.container.cartService, "pricedCart", async () => ({ items: [{}], subtotal: 200 }));
    t.mock.method(server.container.couponRepository, "findByCode", async () => coupon({ code: "SAVE10", type: "fixed", value: 50 }));
    const res = await server.request("POST", "/coupons/check", { headers, body: { code: "save10" } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.data, { code: "SAVE10", type: "fixed", value: 50, subtotal: 200, discount: 50, total: 150 });

    const anonymous = await server.request("POST", "/coupons/check", { body: { code: "save10" } });
    assert.equal(anonymous.status, 401);
  });

  test("coupon management requires orders:manage", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("User"));
    const res = await server.request("GET", "/coupons", { headers });
    assert.equal(res.status, 403);
  });

  test("a duplicate code is a 409 with the contract's message", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("Admin"));
    t.mock.method(server.container.couponRepository, "create", async () => {
      throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { code: 1 } });
    });
    const res = await server.request("POST", "/coupons", { headers, body: { code: "SAVE10", type: "percent", value: 10 } });
    assert.equal(res.status, 409);
    assert.equal(res.json.message, "A coupon with this code already exists");
  });
});

test("round2 keeps money to 2 decimals", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(0.1 + 0.2), 0.3);
});
