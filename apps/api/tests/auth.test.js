import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PasswordHasher } from "../src/security/password-hasher.js";
import { authenticateAs, expectValidationError, makeUser, useTestServer } from "./helpers.js";

describe("authentication and authorization", () => {
  const server = useTestServer();

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
    const headers = authenticateAs(t, server.container, makeUser("User"));
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

  test("POST /book/add rejects an ISBN with a wrong check digit", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("Admin"));
    const res = await server.request("POST", "/book/add", {
      headers,
      body: { bookTitle: "t", author: "a", description: "d", category: "507f1f77bcf86cd799439011", isbn: "9780441172710" },
    });
    expectValidationError(res);
    assert.match(JSON.stringify(res.json.validationErr), /Invalid ISBN/);
  });

  test("lets admins through to request validation", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("Admin"));
    const res = await server.request("POST", "/book/add", { headers });
    expectValidationError(res);
  });

  test("PATCH /book/:id/unlike responds instead of hanging (auth was never invoked)", async () => {
    const res = await server.request("PATCH", "/book/507f1f77bcf86cd799439011/unlike");
    assert.equal(res.status, 401);
  });

  test("tolerates a space between bearer key and token", async (t) => {
    const user = makeUser();
    const { authorization } = authenticateAs(t, server.container, user);
    t.mock.method(server.container.cartRepository, "findByUserId", async () => ({ userId: user._id, books: [] }));
    const spaced = authorization.replace(process.env.BEARER_KEY, `${process.env.BEARER_KEY} `);
    const res = await server.request("GET", "/cart", { headers: { authorization: spaced } });
    assert.equal(res.status, 200);
  });

  test("GET /auth/user is admin-only and never returns password hashes", async (t) => {
    const userHeaders = authenticateAs(t, server.container, makeUser("User"));
    assert.equal((await server.request("GET", "/auth/user", { headers: userHeaders })).status, 403);

    t.mock.restoreAll();
    const adminHeaders = authenticateAs(t, server.container, makeUser("Admin"));
    const list = t.mock.method(server.container.userRepository, "listWithoutSecrets", async () => []);
    const res = await server.request("GET", "/auth/user", { headers: adminHeaders });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.users, []);
    assert.equal(list.mock.callCount(), 1);
  });
});

describe("signup and login", () => {
  const server = useTestServer();

  test("signup validates the request body", async () => {
    const res = await server.request("POST", "/auth/signup", {
      body: { userName: "reader", password: "secret1" },
    });
    expectValidationError(res);
  });

  test("signup rejects mismatched password confirmation", async () => {
    const res = await server.request("POST", "/auth/signup", {
      body: { userName: "reader", email: "a@b.com", password: "secret1", cPassword: "other" },
    });
    assert.equal(res.status, 400);
  });

  test("signup normalizes the email and does not query by an absent phone", async (t) => {
    const emailLookup = t.mock.method(server.container.userRepository, "findByEmail", async () => null);
    const phoneLookup = t.mock.method(server.container.userRepository, "findByPhone", async () => null);
    let created;
    t.mock.method(server.container.userRepository, "create", async (doc) => {
      created = doc;
      return { _id: "id-1" };
    });
    t.mock.method(console, "warn", () => {});

    const res = await server.request("POST", "/auth/signup", {
      body: { userName: "reader", email: "Reader@Example.com", password: "secret1", cPassword: "secret1" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.message, "Done");
    assert.deepEqual(emailLookup.mock.calls[0].arguments, ["reader@example.com"]);
    assert.equal(phoneLookup.mock.callCount(), 0);
    assert.equal(created.email, "reader@example.com");
    assert.notEqual(created.password, "secret1");
  });

  test("login: unconfirmed email -> 403, wrong password -> 401, success -> token", async (t) => {
    const stored = {
      _id: "id-1",
      userName: "reader",
      role: "User",
      confirmEmail: false,
      password: new PasswordHasher(4).hash("secret1"),
    };
    t.mock.method(server.container.userRepository, "findByAnyEmail", async () => stored);
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
