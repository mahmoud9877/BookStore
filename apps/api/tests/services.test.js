// Unit tests for the service classes: every collaborator is a fake passed
// through the constructor, so no database, HTTP or third-party service is involved.
import { Types } from "mongoose";
import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { BadRequestError, HttpError } from "../src/core/http-errors.js";
import { CartService } from "../src/modules/cart/cart.service.js";
import { BookService } from "../src/modules/books/book.service.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { OrderService } from "../src/modules/orders/order.service.js";
import { PasswordHasher } from "../src/security/password-hasher.js";
import { JwtTokenService } from "../src/security/jwt-token-service.js";
import { CategoryService } from "../src/modules/categories/category.service.js";

/** Builds a fake whose methods are mock functions resolving the given values. */
function fake(methods) {
  return Object.fromEntries(
    Object.entries(methods).map(([name, impl]) => [
      name,
      mock.fn(typeof impl === "function" ? impl : async () => impl),
    ])
  );
}

/** Asserts the promise rejects with an HttpError carrying the given status. */
const rejectsWithStatus = (promise, status, message) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof HttpError, `expected HttpError, got ${error}`);
    assert.equal(error.status, status);
    if (message) assert.match(error.message, message);
    return true;
  });

describe("BookService", () => {
  const makeService = (overrides = {}) => {
    const deps = {
      bookRepository: fake({ list: [], create: {}, updateById: {}, addLike: {} }),
      categoryRepository: fake({ findByName: { name: "fiction" } }),
      imageStorage: fake({ upload: { secure_url: "https://img/cover.png" } }),
      ...overrides,
    };
    return { service: new BookService(deps), ...deps };
  };

  test("listBooks paginates only when a positive limit is given", async () => {
    const { service, bookRepository } = makeService();
    await service.listBooks({});
    await service.listBooks({ page: "3", limit: "10" });
    await service.listBooks({ page: "0", limit: "abc" });
    assert.deepEqual(
      bookRepository.list.mock.calls.map((c) => c.arguments),
      [[], [{ skip: 20, limit: 10 }], []]
    );
  });

  test("createBook uploads the cover and stores its URL", async () => {
    const { service, bookRepository, imageStorage } = makeService();
    await service.createBook({ bookTitle: "t", category: "fiction" }, "/tmp/cover.png");
    assert.deepEqual(imageStorage.upload.mock.calls[0].arguments, ["/tmp/cover.png", "book"]);
    assert.equal(bookRepository.create.mock.calls[0].arguments[0].image, "https://img/cover.png");
  });

  test("createBook requires a cover image and keeps the legacy `error` field", async () => {
    const { service, bookRepository } = makeService();
    await assert.rejects(service.createBook({ category: "fiction" }, undefined), (error) => {
      assert.equal(error.status, 400);
      assert.deepEqual(error.details, { error: "Image file is required" });
      return true;
    });
    assert.equal(bookRepository.create.mock.callCount(), 0);
  });

  test("createBook rejects unknown categories before uploading anything", async () => {
    const { service, imageStorage } = makeService({
      categoryRepository: fake({ findByName: null }),
    });
    await rejectsWithStatus(service.createBook({ category: "nope" }, "/tmp/c.png"), 404, /Category/);
    assert.equal(imageStorage.upload.mock.callCount(), 0);
  });

  test("updateBook ignores fields that are not book attributes", async () => {
    const { service, bookRepository } = makeService();
    await service.updateBook("id-1", { bookTitle: "t", category: "fiction", totalLikes: 999 });
    const [, fields] = bookRepository.updateById.mock.calls[0].arguments;
    assert.equal(fields.bookTitle, "t");
    assert.equal("totalLikes" in fields, false);
    assert.equal("image" in fields, false);
  });

  test("likeBook reports an existing like as a 400", async () => {
    const { service } = makeService({ bookRepository: fake({ addLike: null }) });
    await rejectsWithStatus(service.likeBook("b", "u"), 400, /already liked/);
  });
});

describe("CategoryService", () => {
  test("updateCategory only accepts the predefined options", async () => {
    const categoryRepository = fake({ updateById: {} });
    const service = new CategoryService({ categoryRepository });
    await rejectsWithStatus(service.updateCategory("id", "poetry"), 400, /Choose from/);
    assert.equal(categoryRepository.updateById.mock.callCount(), 0);
  });

  test("deleteCategory reports a missing category as 404", async () => {
    const service = new CategoryService({ categoryRepository: fake({ deleteById: null }) });
    await rejectsWithStatus(service.deleteCategory("id"), 404);
  });
});

describe("CartService", () => {
  test("adding a book already in the cart increases its quantity within stock", async () => {
    const bookId = new Types.ObjectId();
    const cart = { books: [{ bookId, quantity: 1 }] };
    const service = new CartService({
      bookRepository: fake({ findById: { quantity: 3 } }),
      cartRepository: fake({ findByUserId: cart, save: async (saved) => saved }),
    });

    const { created } = await service.addItem("u", bookId.toString(), 2);
    assert.equal(created, false);
    assert.equal(cart.books[0].quantity, 3);
    await rejectsWithStatus(service.addItem("u", bookId.toString(), 1), 400, /exceeds/);
  });

  test("addItem coerces the requested quantity to a number", async () => {
    const bookId = new Types.ObjectId();
    const cart = { books: [{ bookId, quantity: 1 }] };
    const service = new CartService({
      bookRepository: fake({ findById: { quantity: 5 } }),
      cartRepository: fake({ findByUserId: cart, save: async (saved) => saved }),
    });
    await service.addItem("u", bookId.toString(), "2");
    assert.equal(cart.books[0].quantity, 3);
  });

  test("the first item creates the cart", async () => {
    const cartRepository = fake({
      findByUserId: null,
      createForUser: async (userId, books) => ({ userId, books }),
    });
    const service = new CartService({
      cartRepository,
      bookRepository: fake({ findById: { quantity: 5, price: 10 } }),
    });
    const { cart, created } = await service.addItem("u", "b", 1);
    assert.equal(created, true);
    assert.equal(cart.books.length, 1);
  });

  test("removeItem reports a book that is not in the cart", async () => {
    const service = new CartService({
      cartRepository: fake({ findByUserId: { books: [] } }),
      bookRepository: fake({}),
    });
    await rejectsWithStatus(service.removeItem("u", "b"), 404, /not found in cart/);
  });
});

describe("OrderService", () => {
  const user = { _id: new Types.ObjectId(), email: "reader@example.com" };
  const makeService = (overrides = {}) => {
    const deps = {
      orderRepository: fake({ create: async (doc) => ({ _id: "order-1", ...doc }), updateStatus: {} }),
      cartRepository: fake({ findByUserId: { books: [] }, clearByUserId: {} }),
      bookRepository: fake({ decrementStock: null, incrementStock: {} }),
      paymentGateway: { isConfigured: true, ...fake({ createCheckoutSession: { url: "https://pay" } }) },
      ...overrides,
    };
    return { service: new OrderService(deps), ...deps };
  };

  test("placeOrder refuses an empty cart without touching stock", async () => {
    const { service, bookRepository } = makeService();
    await rejectsWithStatus(service.placeOrder(user, {}), 400, /Empty Cart/);
    assert.equal(bookRepository.decrementStock.mock.callCount(), 0);
  });

  test("card orders fail fast when payments are not configured", async () => {
    const { service, cartRepository } = makeService({ paymentGateway: { isConfigured: false } });
    await rejectsWithStatus(service.placeOrder(user, { paymentType: "card" }), 503);
    assert.equal(cartRepository.findByUserId.mock.callCount(), 0);
  });

  test("card orders await payment and return the checkout session", async () => {
    const bookId = new Types.ObjectId();
    const { service, paymentGateway } = makeService({
      cartRepository: fake({ findByUserId: { books: [{ bookId, quantity: 2 }] }, clearByUserId: {} }),
      bookRepository: fake({ decrementStock: { _id: bookId, bookTitle: "dune", price: 12.5 } }),
    });

    const { order, session } = await service.placeOrder(user, { paymentType: "card" });

    assert.equal(order.status, "waitPayment");
    assert.equal(session.url, "https://pay");
    const [checkout] = paymentGateway.createCheckoutSession.mock.calls[0].arguments;
    assert.equal(checkout.customerEmail, user.email);
    assert.equal(checkout.lineItems[0].price_data.unit_amount, 1250);
  });

  test("a failed checkout session rejects the order, releases stock and keeps the cart", async () => {
    const bookId = new Types.ObjectId();
    const { service, orderRepository, bookRepository, cartRepository } = makeService({
      cartRepository: fake({ findByUserId: { books: [{ bookId, quantity: 1 }] }, clearByUserId: {} }),
      bookRepository: fake({ decrementStock: { _id: bookId, price: 5 }, incrementStock: {} }),
      paymentGateway: {
        isConfigured: true,
        ...fake({ createCheckoutSession: async () => { throw new Error("stripe down"); } }),
      },
    });
    mock.method(console, "error", () => {});

    await rejectsWithStatus(service.placeOrder(user, { paymentType: "card" }), 502);
    assert.deepEqual(orderRepository.updateStatus.mock.calls[0].arguments, ["order-1", "rejected"]);
    assert.deepEqual(bookRepository.incrementStock.mock.calls[0].arguments, [bookId, 1]);
    assert.equal(cartRepository.clearByUserId.mock.callCount(), 0);
    console.error.mock.restore();
  });

  test("placeOrder releases stock when the order cannot be saved", async () => {
    const bookId = new Types.ObjectId();
    const { service, bookRepository, cartRepository } = makeService({
      orderRepository: fake({ create: async () => { throw new Error("write failed"); } }),
      cartRepository: fake({ findByUserId: { books: [{ bookId, quantity: 2 }] }, clearByUserId: {} }),
      bookRepository: fake({ decrementStock: { _id: bookId, price: 5 }, incrementStock: {} }),
    });

    await assert.rejects(service.placeOrder(user, {}), /write failed/);
    assert.deepEqual(bookRepository.incrementStock.mock.calls[0].arguments, [bookId, 2]);
    assert.equal(cartRepository.clearByUserId.mock.callCount(), 0, "cart is kept when the order fails");
  });

  test("cancelOrder only cancels placed cash / unpaid card orders and restocks", async () => {
    const bookId = new Types.ObjectId();
    const order = { paymentType: "cash", status: "delivered", books: [{ bookId, quantity: 1 }] };
    const { service, orderRepository, bookRepository } = makeService({
      orderRepository: fake({ findByIdForUser: order, updateStatus: { status: "canceled" } }),
    });

    await rejectsWithStatus(service.cancelOrder("o", user._id, "why"), 400, /delivered/);
    assert.equal(orderRepository.updateStatus.mock.callCount(), 0);

    order.status = "placed";
    await service.cancelOrder("o", user._id, "changed my mind");
    assert.deepEqual(orderRepository.updateStatus.mock.calls[0].arguments, [
      "o",
      "canceled",
      { updatedBy: user._id, reason: "changed my mind" },
    ]);
    assert.deepEqual(bookRepository.incrementStock.mock.calls[0].arguments, [bookId, 1]);
  });

  test("deliverOrder refuses orders that are not deliverable", async () => {
    for (const status of ["waitPayment", "canceled", "rejected", "delivered"]) {
      const { service } = makeService({ orderRepository: fake({ findById: { status } }) });
      await rejectsWithStatus(service.deliverOrder("o", "admin"), 400);
    }
  });

  const gatewayEmitting = (event) => ({
    isConfigured: true,
    constructWebhookEvent: mock.fn(() => event),
  });

  test("processStripeWebhook verifies the payload before applying it", async () => {
    const paymentGateway = gatewayEmitting({
      type: "checkout.session.completed",
      data: { object: { metadata: { orderId: "o" } } },
    });
    const { service, orderRepository } = makeService({ paymentGateway });
    const outcome = await service.processStripeWebhook("raw-body", "sig");
    assert.equal(outcome, "Done");
    assert.deepEqual(paymentGateway.constructWebhookEvent.mock.calls[0].arguments, ["raw-body", "sig"]);
    assert.deepEqual(orderRepository.updateStatus.mock.calls[0].arguments, ["o", "placed"]);
  });

  test("processStripeWebhook rejects (not throws synchronously) on a bad signature", async () => {
    const { service } = makeService({
      paymentGateway: {
        constructWebhookEvent: () => {
          throw new BadRequestError("Webhook Error: bad signature");
        },
      },
    });
    const pending = service.processStripeWebhook("raw", "bad");
    assert.ok(pending instanceof Promise);
    await rejectsWithStatus(pending, 400, /Webhook Error/);
  });

  test("a failure event for an already-handled order does not restock twice", async () => {
    const { service, bookRepository } = makeService({
      orderRepository: fake({ rejectIfAwaitingPayment: null }),
      paymentGateway: gatewayEmitting({
        type: "checkout.session.expired",
        data: { object: { metadata: { orderId: "o" } } },
      }),
    });
    const outcome = await service.processStripeWebhook("raw", "sig");
    assert.equal(outcome, "rejected link");
    assert.equal(bookRepository.incrementStock.mock.callCount(), 0);
  });
});

describe("AuthService", () => {
  const emailTokens = new JwtTokenService("email-secret");
  const makeService = (overrides = {}) => {
    const deps = {
      userRepository: fake({ findByEmail: null, findByPhone: null, create: { _id: "u1" } }),
      passwordHasher: new PasswordHasher(4),
      accessTokens: new JwtTokenService("access-secret"),
      emailTokens,
      mailer: { isConfigured: true, ...fake({ send: true }) },
      requireEmailConfirmation: true,
      ...overrides,
    };
    return { service: new AuthService(deps), ...deps };
  };

  test("registerUser hashes the password and emails a confirmation link", async () => {
    const { service, userRepository, mailer } = makeService();
    const result = await service.registerUser(
      { userName: "reader", email: "Reader@Example.com", password: "secret1" },
      { apiBaseUrl: "https://shop/api" }
    );

    const [created] = userRepository.create.mock.calls[0].arguments;
    assert.equal(created.email, "reader@example.com");
    assert.notEqual(created.password, "secret1");
    assert.equal(created.confirmEmail, false);
    assert.equal(emailTokens.verify(result.token).email, "reader@example.com");
    assert.match(mailer.send.mock.calls[0].arguments[0].html, /https:\/\/shop\/api\/auth\/confirmEmail\//);
  });

  test("without required confirmation, accounts start confirmed and no email is sent", async () => {
    const { service, userRepository, mailer } = makeService({ requireEmailConfirmation: false });
    await service.registerUser(
      { userName: "reader", email: "a@b.com", password: "secret1" },
      { apiBaseUrl: "x" }
    );
    assert.equal(userRepository.create.mock.calls[0].arguments[0].confirmEmail, true);
    assert.equal(mailer.send.mock.callCount(), 0);
  });

  test("registerUser rejects a duplicate email with 409", async () => {
    const { service } = makeService({ userRepository: fake({ findByEmail: { _id: "x" } }) });
    await rejectsWithStatus(
      service.registerUser({ email: "a@b.com", password: "p" }, { apiBaseUrl: "x" }),
      409
    );
  });

  test("confirmEmail redirects to the web login page only when a frontend is configured", async () => {
    const token = emailTokens.sign({ email: "a@b.com" });
    const userRepository = fake({ markEmailConfirmed: { _id: "u1" } });
    const withFrontend = makeService({ userRepository, frontendUrl: "https://shop" }).service;
    const withoutFrontend = makeService({ userRepository }).service;
    assert.deepEqual(await withFrontend.confirmEmail(token), {
      redirectUrl: "https://shop/#/login",
      message: "Done",
    });
    assert.deepEqual(await withoutFrontend.confirmEmail(token), { redirectUrl: null, message: "Done" });
  });

  test("confirmEmail rejects tokens signed with another secret", async () => {
    const { service } = makeService({ userRepository: fake({ markEmailConfirmed: {} }) });
    const forged = new JwtTokenService("other-secret").sign({ email: "a@b.com" });
    await assert.rejects(service.confirmEmail(forged), { name: "JsonWebTokenError" });
  });
});
