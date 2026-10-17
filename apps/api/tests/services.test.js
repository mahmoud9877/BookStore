// Unit tests for the service classes: every collaborator is a fake passed
// through the constructor, so no database, HTTP or third-party service is involved.
import { Types } from "mongoose";
import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { BadRequestError, HttpError } from "../src/core/http-errors.js";
import { CartService } from "../src/modules/cart/cart.service.js";
import { BookService } from "../src/modules/books/book.service.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { EmailConfirmationService } from "../src/modules/auth/email-confirmation.service.js";
import { OrderPolicy } from "../src/modules/orders/order-policy.js";
import { PAYMENT_OUTCOMES } from "../src/modules/orders/payment-gateway.js";
import { OrderService } from "../src/modules/orders/order.service.js";
import { PasswordHasher } from "../src/security/password-hasher.js";
import { JwtTokenService } from "../src/security/jwt-token-service.js";
import { CategoryService } from "../src/modules/categories/category.service.js";
import { AddToCartDto } from "../src/modules/cart/cart.dto.js";
import { CreateBookDto, ListBooksQueryDto, UpdateBookDto } from "../src/modules/books/book.dto.js";

/** Parses raw input into a DTO exactly as the validate middleware does. */
const parse = (Dto, input) => {
  const { dto, error } = Dto.parse(input);
  if (error) throw error;
  return dto;
};
const bookInput = {
  bookTitle: "t",
  author: "a",
  description: "d",
  price: 10,
  category: "fiction",
  quantity: 2,
};

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
/** BookRepository fake whose reserveStock succeeds, pricing each book with `book`. */
const reservingAll = (book, extra = {}) =>
  fake({
    reserveStock: async (items) => ({
      reserved: items.map((item) => ({ book: { ...book, _id: item.bookId }, quantity: item.quantity })),
    }),
    releaseStock: undefined,
    ...extra,
  });

/** The `{ bookId, quantity }` pairs a releaseStock call put back. */
const released = (bookRepository, call = 0) =>
  bookRepository.releaseStock.mock.calls[call].arguments[0].map(({ bookId, quantity }) => ({
    bookId,
    quantity,
  }));

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
    await service.listBooks(parse(ListBooksQueryDto, {}));
    await service.listBooks(parse(ListBooksQueryDto, { page: "3", limit: "10" }));
    await service.listBooks(parse(ListBooksQueryDto, { page: "0", limit: "abc" }));
    assert.deepEqual(
      bookRepository.list.mock.calls.map((c) => c.arguments),
      [[], [{ skip: 20, limit: 10 }], []]
    );
  });

  test("createBook uploads the cover and stores its URL", async () => {
    const { service, bookRepository, imageStorage } = makeService();
    await service.createBook(parse(CreateBookDto, bookInput), "/tmp/cover.png");
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

  test("updateBook persists only book attributes, never extra client fields", async () => {
    const { service, bookRepository } = makeService();
    const id = new Types.ObjectId().toString();
    await service.updateBook(parse(UpdateBookDto, { ...bookInput, id, totalLikes: 999 }));
    const [updatedId, fields] = bookRepository.updateById.mock.calls[0].arguments;
    assert.equal(updatedId, id);
    assert.equal(fields.bookTitle, "t");
    assert.equal("id" in fields, false);
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
  /** CartService over a fake cart repository and a book with the given attributes. */
  const cartServiceWith = (cartMethods, book = { quantity: 5, price: 10 }) => {
    const cartRepository = fake(cartMethods);
    return { cartRepository, service: new CartService({ cartRepository, bookRepository: fake({ findById: book }) }) };
  };

  test("adding a book already in the cart increments its quantity within stock", async () => {
    const bookId = new Types.ObjectId();
    const cartRepository = fake({
      findByUserId: { books: [{ bookId, quantity: 1 }] },
      incrementItemQuantity: async (userId, id, quantity) => ({ books: [{ bookId, quantity: 1 + quantity }] }),
      addItem: undefined,
    });
    const service = new CartService({ cartRepository, bookRepository: fake({ findById: { quantity: 3 } }) });

    const add = (quantity) =>
      service.addItem("u", parse(AddToCartDto, { bookId: bookId.toString(), quantity }));
    const { cart, created } = await add(2);
    assert.equal(created, false);
    assert.equal(cart.books[0].quantity, 3);
    assert.deepEqual(cartRepository.incrementItemQuantity.mock.calls[0].arguments, ["u", bookId.toString(), 2]);
    assert.equal(cartRepository.addItem.mock.callCount(), 0);

    await rejectsWithStatus(add(3), 400, /exceeds/);
    assert.equal(cartRepository.incrementItemQuantity.mock.callCount(), 1, "no write when over stock");
  });

  test("adding a new book to an existing cart appends a line item", async () => {
    const bookId = new Types.ObjectId().toString();
    const { service, cartRepository } = cartServiceWith(
      { findByUserId: { books: [] }, addItem: async (userId, item) => ({ books: [item] }) },
      { quantity: 5, price: 10, bookTitle: "dune", image: "i" }
    );
    const { cart } = await service.addItem("u", parse(AddToCartDto, { bookId, quantity: 2 }));
    assert.deepEqual(cartRepository.addItem.mock.calls[0].arguments[1], {
      bookId,
      bookTitle: "dune",
      price: 10,
      quantity: 2,
      image: "i",
    });
    assert.equal(cart.books.length, 1);
  });

  test("the first item creates the cart", async () => {
    const { service } = cartServiceWith({
      findByUserId: null,
      createForUser: async (userId, books) => ({ userId, books }),
    });
    const { cart, created } = await service.addItem(
      "u",
      parse(AddToCartDto, { bookId: new Types.ObjectId().toString(), quantity: 1 })
    );
    assert.equal(created, true);
    assert.equal(cart.books.length, 1);
  });

  test("removeItem tells a missing cart apart from a book that is not in it", async () => {
    const withCart = new CartService({
      cartRepository: fake({ removeItem: null, findByUserId: { books: [] } }),
      bookRepository: fake({}),
    });
    await rejectsWithStatus(withCart.removeItem("u", "b"), 404, /not found in cart/);

    const withoutCart = new CartService({
      cartRepository: fake({ removeItem: null, findByUserId: null }),
      bookRepository: fake({}),
    });
    await rejectsWithStatus(withoutCart.removeItem("u", "b"), 404, /^Cart not found$/);
  });
});

describe("OrderPolicy", () => {
  test("card orders start awaiting payment, cash orders start placed", () => {
    assert.equal(OrderPolicy.initialStatus("card"), "waitPayment");
    assert.equal(OrderPolicy.initialStatus("cash"), "placed");
  });

  test("cancellation is allowed only before shipping (cash) or payment (card)", () => {
    assert.equal(OrderPolicy.canBeCancelled({ paymentType: "cash", status: "placed" }), true);
    assert.equal(OrderPolicy.canBeCancelled({ paymentType: "card", status: "waitPayment" }), true);
    assert.equal(OrderPolicy.canBeCancelled({ paymentType: "card", status: "placed" }), false);
    assert.equal(OrderPolicy.canBeCancelled({ paymentType: "cash", status: "onWay" }), false);
  });

  test("only placed or in-transit orders can be delivered", () => {
    const deliverable = ["waitPayment", "placed", "canceled", "rejected", "onWay", "delivered"].filter(
      (status) => OrderPolicy.canBeDelivered({ status })
    );
    assert.deepEqual(deliverable, ["placed", "onWay"]);
  });
});

describe("OrderService", () => {
  const user = { _id: new Types.ObjectId(), email: "reader@example.com" };
  /** Payment gateway fake implementing the port in modules/orders/payment-gateway.js. */
  const gateway = (methods = {}) => ({
    isConfigured: true,
    ...fake({ createCheckout: { id: "cs_1", url: "https://pay" }, parseWebhookEvent: () => ({}), ...methods }),
  });
  const makeService = (overrides = {}) => {
    const deps = {
      orderRepository: fake({ create: async (doc) => ({ _id: "order-1", ...doc }), updateStatus: {} }),
      cartRepository: fake({ findByUserId: { books: [] }, clearByUserId: {} }),
      bookRepository: reservingAll({ price: 1 }),
      paymentGateway: gateway(),
      ...overrides,
    };
    return { service: new OrderService(deps), ...deps };
  };
  const cartWith = (...books) => fake({ findByUserId: { books }, clearByUserId: {} });

  test("placeOrder refuses an empty cart without touching stock", async () => {
    const { service, bookRepository } = makeService();
    await rejectsWithStatus(service.placeOrder(user, {}), 400, /Empty Cart/);
    assert.equal(bookRepository.reserveStock.mock.callCount(), 0);
  });

  test("placeOrder reports the item the repository could not reserve", async () => {
    const missing = { bookId: new Types.ObjectId(), bookTitle: "dune", quantity: 9 };
    const { service, orderRepository } = makeService({
      cartRepository: cartWith(missing),
      bookRepository: fake({ reserveStock: { unavailable: missing } }),
    });
    await rejectsWithStatus(service.placeOrder(user, {}), 400, /out of stock: dune/);
    assert.equal(orderRepository.create.mock.callCount(), 0);
  });

  test("card orders fail fast when payments are not configured", async () => {
    const { service, cartRepository } = makeService({ paymentGateway: { isConfigured: false } });
    await rejectsWithStatus(service.placeOrder(user, { paymentType: "card" }), 503);
    assert.equal(cartRepository.findByUserId.mock.callCount(), 0);
  });

  test("card orders await payment and pass provider-neutral line items to the gateway", async () => {
    const bookId = new Types.ObjectId();
    const { service, paymentGateway } = makeService({
      cartRepository: cartWith({ bookId, quantity: 2 }),
      bookRepository: reservingAll({ bookTitle: "dune", price: 12.5 }),
    });

    const { order, session } = await service.placeOrder(user, { paymentType: "card" });

    assert.equal(order.status, "waitPayment");
    assert.deepEqual({ ...session }, { id: "cs_1", url: "https://pay" });
    assert.deepEqual(paymentGateway.createCheckout.mock.calls[0].arguments[0], {
      orderId: "order-1",
      customerEmail: user.email,
      items: [{ name: "dune", unitPrice: 12.5, quantity: 2 }],
    });
  });

  test("a failed checkout rejects the order, releases stock and keeps the cart", async () => {
    const bookId = new Types.ObjectId();
    const { service, orderRepository, bookRepository, cartRepository } = makeService({
      cartRepository: cartWith({ bookId, quantity: 1 }),
      bookRepository: reservingAll({ price: 5 }),
      paymentGateway: gateway({ createCheckout: async () => { throw new Error("provider down"); } }),
    });
    mock.method(console, "error", () => {});

    await rejectsWithStatus(service.placeOrder(user, { paymentType: "card" }), 502);
    assert.deepEqual(orderRepository.updateStatus.mock.calls[0].arguments, ["order-1", "rejected"]);
    assert.deepEqual(released(bookRepository), [{ bookId, quantity: 1 }]);
    assert.equal(cartRepository.clearByUserId.mock.callCount(), 0);
    console.error.mock.restore();
  });

  test("placeOrder releases stock when the order cannot be saved", async () => {
    const bookId = new Types.ObjectId();
    const { service, bookRepository, cartRepository } = makeService({
      orderRepository: fake({ create: async () => { throw new Error("write failed"); } }),
      cartRepository: cartWith({ bookId, quantity: 2 }),
      bookRepository: reservingAll({ price: 5 }),
    });

    await assert.rejects(service.placeOrder(user, {}), /write failed/);
    assert.deepEqual(released(bookRepository), [{ bookId, quantity: 2 }]);
    assert.equal(cartRepository.clearByUserId.mock.callCount(), 0, "cart is kept when the order fails");
  });

  test("cancelOrder applies the policy and restocks", async () => {
    const bookId = new Types.ObjectId();
    const order = { paymentType: "cash", status: "delivered", books: [{ bookId, quantity: 1 }] };
    const { service, orderRepository, bookRepository } = makeService({
      orderRepository: fake({ findByIdForUser: order, updateStatus: { status: "canceled" } }),
    });

    const cancel = (reason) => service.cancelOrder({ orderId: "o", reason }, user._id);
    await rejectsWithStatus(cancel("why"), 400, /delivered/);
    assert.equal(orderRepository.updateStatus.mock.callCount(), 0);

    order.status = "placed";
    await cancel("changed my mind");
    assert.deepEqual(orderRepository.updateStatus.mock.calls[0].arguments, [
      "o",
      "canceled",
      { updatedBy: user._id, reason: "changed my mind" },
    ]);
    assert.deepEqual(released(bookRepository), [{ bookId, quantity: 1 }]);
  });

  test("deliverOrder refuses orders the policy does not allow", async () => {
    for (const status of ["waitPayment", "canceled", "rejected", "delivered"]) {
      const { service } = makeService({ orderRepository: fake({ findById: { status } }) });
      await rejectsWithStatus(service.deliverOrder("o", "admin"), 400);
    }
  });

  const webhook = (event) => gateway({ parseWebhookEvent: () => event });

  test("a paid outcome places the order", async () => {
    const paymentGateway = webhook({ outcome: PAYMENT_OUTCOMES.paid, orderId: "o" });
    const { service, orderRepository } = makeService({ paymentGateway });
    assert.equal(await service.processPaymentWebhook("raw-body", "sig"), "Done");
    assert.deepEqual(paymentGateway.parseWebhookEvent.mock.calls[0].arguments, ["raw-body", "sig"]);
    assert.deepEqual(orderRepository.updateStatus.mock.calls[0].arguments, ["o", "placed"]);
  });

  test("ignored outcomes and events without an order change nothing", async () => {
    for (const event of [{ outcome: PAYMENT_OUTCOMES.ignored, orderId: "o" }, { outcome: PAYMENT_OUTCOMES.paid }]) {
      const { service, orderRepository } = makeService({ paymentGateway: webhook(event) });
      assert.equal(await service.processPaymentWebhook("raw", "sig"), "Ignored");
      assert.equal(orderRepository.updateStatus.mock.callCount(), 0);
    }
  });

  test("an invalid signature rejects (never throws synchronously)", async () => {
    const { service } = makeService({
      paymentGateway: gateway({
        parseWebhookEvent: () => {
          throw new BadRequestError("Webhook Error: bad signature");
        },
      }),
    });
    const pending = service.processPaymentWebhook("raw", "bad");
    assert.ok(pending instanceof Promise);
    await rejectsWithStatus(pending, 400, /Webhook Error/);
  });

  test("a failed outcome for an already-handled order does not restock twice", async () => {
    const { service, bookRepository } = makeService({
      orderRepository: fake({ rejectIfAwaitingPayment: null }),
      paymentGateway: webhook({ outcome: PAYMENT_OUTCOMES.failed, orderId: "o" }),
    });
    assert.equal(await service.processPaymentWebhook("raw", "sig"), "rejected link");
    assert.equal(bookRepository.releaseStock.mock.callCount(), 0);
  });
});

describe("EmailConfirmationService", () => {
  const emailTokens = new JwtTokenService("email-secret");
  const makeService = (overrides = {}) => {
    const deps = {
      userRepository: fake({ markEmailConfirmed: { _id: "u1" }, findByEmail: null }),
      emailTokens,
      mailer: { isConfigured: true, ...fake({ send: true }) },
      ...overrides,
    };
    return { service: new EmailConfirmationService(deps), ...deps };
  };

  test("sendConfirmation emails a link to GET /auth/confirmEmail", async () => {
    const { service, mailer } = makeService();
    await service.sendConfirmation({ email: "a@b.com", userName: "reader" }, { apiBaseUrl: "https://shop/api" });
    const [message] = mailer.send.mock.calls[0].arguments;
    assert.equal(message.to, "a@b.com");
    assert.match(message.html, /https:\/\/shop\/api\/auth\/confirmEmail\//);
  });

  test("sendConfirmation is skipped when no mailer is configured", async () => {
    const { service } = makeService({ mailer: { isConfigured: false, send: mock.fn() } });
    mock.method(console, "warn", () => {});
    await service.sendConfirmation({ email: "a@b.com" }, { apiBaseUrl: "x" });
    console.warn.mock.restore();
  });

  test("issued tokens verify with the email-token secret", () => {
    const { service } = makeService();
    const { token, refreshToken } = service.issueTokens("a@b.com");
    assert.equal(emailTokens.verify(token).email, "a@b.com");
    assert.equal(emailTokens.verify(refreshToken).email, "a@b.com");
  });

  test("confirm redirects to the web login page only when a frontend is configured", async () => {
    const token = emailTokens.sign({ email: "a@b.com" });
    const withFrontend = makeService({ frontendUrl: "https://shop" }).service;
    const withoutFrontend = makeService().service;
    assert.deepEqual(await withFrontend.confirm(token), {
      redirectUrl: "https://shop/#/login",
      message: "Done",
    });
    assert.deepEqual(await withoutFrontend.confirm(token), { redirectUrl: null, message: "Done" });
  });

  test("confirm rejects tokens signed with another secret", async () => {
    const { service } = makeService();
    const forged = new JwtTokenService("other-secret").sign({ email: "a@b.com" });
    await assert.rejects(service.confirm(forged), { name: "JsonWebTokenError" });
  });
});

describe("AuthService", () => {
  const makeService = (overrides = {}) => {
    const deps = {
      userRepository: fake({ findByEmail: null, findByPhone: null, create: { _id: "u1" } }),
      passwordHasher: new PasswordHasher(4),
      accessTokens: new JwtTokenService("access-secret"),
      emailConfirmation: fake({
        sendConfirmation: undefined,
        issueTokens: () => ({ token: "t", refreshToken: "r" }),
      }),
      requireEmailConfirmation: true,
      ...overrides,
    };
    return { service: new AuthService(deps), ...deps };
  };

  test("registerUser hashes the password and asks for email confirmation", async () => {
    const { service, userRepository, emailConfirmation } = makeService();
    const result = await service.registerUser(
      { userName: "reader", email: "Reader@Example.com", password: "secret1" },
      { apiBaseUrl: "https://shop/api" }
    );

    const [created] = userRepository.create.mock.calls[0].arguments;
    assert.equal(created.email, "reader@example.com");
    assert.notEqual(created.password, "secret1");
    assert.equal(created.confirmEmail, false);
    assert.deepEqual(result, { _id: "u1", token: "t", refreshToken: "r" });
    assert.deepEqual(emailConfirmation.sendConfirmation.mock.calls[0].arguments, [
      { email: "reader@example.com", userName: "reader", phone: undefined },
      { apiBaseUrl: "https://shop/api" },
    ]);
  });

  test("without required confirmation, accounts start confirmed and no email is sent", async () => {
    const { service, userRepository, emailConfirmation } = makeService({ requireEmailConfirmation: false });
    await service.registerUser({ userName: "reader", email: "a@b.com", password: "secret1" }, { apiBaseUrl: "x" });
    assert.equal(userRepository.create.mock.calls[0].arguments[0].confirmEmail, true);
    assert.equal(emailConfirmation.sendConfirmation.mock.callCount(), 0);
  });

  test("registerUser rejects a duplicate email with 409", async () => {
    const { service } = makeService({ userRepository: fake({ findByEmail: { _id: "x" } }) });
    await rejectsWithStatus(service.registerUser({ email: "a@b.com", password: "p" }, { apiBaseUrl: "x" }), 409);
  });

  test("login signs an access token for confirmed users with the right password", async () => {
    const passwordHasher = new PasswordHasher(4);
    const accessTokens = new JwtTokenService("access-secret");
    const user = { _id: "u1", userName: "reader", role: "Admin", confirmEmail: true, password: passwordHasher.hash("secret1") };
    const { service } = makeService({ userRepository: fake({ findByAnyEmail: user }), passwordHasher, accessTokens });

    await rejectsWithStatus(service.login({ email: "a@b.com", password: "wrong" }), 401);
    const { token, role } = await service.login({ email: "a@b.com", password: "secret1" });
    assert.equal(role, "Admin");
    assert.equal(accessTokens.verify(token).id, "u1");
  });
});
