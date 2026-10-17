import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import userModel from "../src/modules/users/user.model.js";
import { hashPassword } from "../src/security/password.js";
import { authenticateAs, makeUser, startServer } from "./helpers.js";

describe("authentication and authorization", () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.close());

  test("rejects requests without the bearer key", async () => {
    const res = await server.request("POST", "/book/add");
    assert.equal(res.status, 401);
    assert.equal(res.json.message, "Invalid bearer key");
  });

  test("rejects tokens with an invalid signature", async () => {
    const res = await server.request("POST", "/book/add", {
      headers: { authorization: `${process.env.BEARER_KEY}not.a.jwt` },
    });
    assert.equal(res.status, 401);
  });

  test("forbids regular users from admin-only book routes", async (t) => {
    const headers = authenticateAs(t, makeUser("User"));
    for (const [method, path] of [
      ["POST", "/book/add"],
      ["POST", "/book/edit/507f1f77bcf86cd799439011"],
      ["DELETE", "/book/delete/507f1f77bcf86cd799439011"],
      ["POST", "/category"],
    ]) {
      const res = await server.request(method, path, { headers });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
  });

  test("lets admins through to request validation", async (t) => {
    const headers = authenticateAs(t, makeUser("Admin"));
    const res = await server.request("POST", "/book/add", { headers });
    assert.equal(res.status, 400);
    assert.equal(res.json.message, "validationErr");
  });

  test("PATCH /book/:id/unlike responds instead of hanging (auth was never invoked)", async () => {
    const res = await server.request("PATCH", "/book/507f1f77bcf86cd799439011/unlike");
    assert.equal(res.status, 401);
  });

  test("tolerates a space between bearer key and token", async (t) => {
    const user = makeUser();
    const { authorization } = authenticateAs(t, user);
    const cartModel = (await import("../src/modules/cart/cart.model.js")).default;
    t.mock.method(cartModel, "findOne", async () => ({ userId: user._id, books: [] }));
    const spaced = authorization.replace(process.env.BEARER_KEY, `${process.env.BEARER_KEY} `);
    const res = await server.request("GET", "/cart", { headers: { authorization: spaced } });
    assert.equal(res.status, 200);
  });

  test("GET /auth/user is admin-only and never returns password hashes", async (t) => {
    const userHeaders = authenticateAs(t, makeUser("User"));
    assert.equal((await server.request("GET", "/auth/user", { headers: userHeaders })).status, 403);

    t.mock.restoreAll();
    const adminHeaders = authenticateAs(t, makeUser("Admin"));
    let projection;
    t.mock.method(userModel, "find", () => ({
      select: async (fields) => {
        projection = fields;
        return [];
      },
    }));
    const res = await server.request("GET", "/auth/user", { headers: adminHeaders });
    assert.equal(res.status, 200);
    assert.match(projection, /-password/);
  });
});

describe("signup and login", () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.close());

  test("signup validates the request body", async () => {
    const res = await server.request("POST", "/auth/signup", {
      body: { userName: "reader", password: "secret1" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.message, "validationErr");
  });

  test("signup rejects mismatched password confirmation", async () => {
    const res = await server.request("POST", "/auth/signup", {
      body: { userName: "reader", email: "a@b.com", password: "secret1", cPassword: "other" },
    });
    assert.equal(res.status, 400);
  });

  test("signup normalizes the email and does not query by an absent phone", async (t) => {
    const lookups = [];
    t.mock.method(userModel, "findOne", async (filter) => {
      lookups.push(filter);
      return null;
    });
    let created;
    t.mock.method(userModel, "create", async (doc) => {
      created = doc;
      return { _id: "id-1" };
    });
    t.mock.method(console, "warn", () => {});

    const res = await server.request("POST", "/auth/signup", {
      body: { userName: "reader", email: "Reader@Example.com", password: "secret1", cPassword: "secret1" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.message, "Done");
    assert.deepEqual(lookups, [{ email: "reader@example.com" }]);
    assert.equal(created.email, "reader@example.com");
    assert.notEqual(created.password, "secret1");
  });

  test("login: unconfirmed email -> 403, wrong password -> 401, success -> token", async (t) => {
    const stored = {
      _id: "id-1",
      userName: "reader",
      role: "User",
      confirmEmail: false,
      password: hashPassword({ plaintext: "secret1" }),
    };
    t.mock.method(userModel, "findOne", async () => stored);
    const login = (password) =>
      server.request("POST", "/auth/login", { body: { email: "reader@example.com", password } });

    assert.equal((await login("secret1")).status, 403);
    stored.confirmEmail = true;
    assert.equal((await login("wrong")).status, 401);
    const ok = await login("secret1");
    assert.equal(ok.status, 200);
    assert.equal(ok.json.message, "Done");
    assert.equal(ok.json.role, "User");
    assert.ok(ok.json.token);
  });
});
