import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { expectValidationError, useTestServer } from "./helpers.js";
import { createErrorHandler, resolveStatus } from "../src/middleware/error-handler.js";

describe("app", () => {
  const server = useTestServer();

  test("GET / returns the welcome message", async () => {
    const res = await server.request("GET", "/");
    assert.equal(res.status, 200);
    assert.equal(res.text, "Welcome in my bookStore project");
  });

  test("GET /health reports 503 while the database is disconnected", async () => {
    const res = await server.request("GET", "/health");
    assert.equal(res.status, 503);
    assert.deepEqual(res.json, { status: "degraded", database: "down" });
  });

  test("unknown routes return 404 JSON", async () => {
    const res = await server.request("GET", "/does-not-exist");
    assert.equal(res.status, 404);
    assert.match(res.json.message, /Route not found: GET \/does-not-exist/);
  });

  test("malformed JSON bodies return 400", async () => {
    const res = await server.request("POST", "/auth/login", {
      raw: "{not json",
      headers: { "content-type": "application/json" },
    });
    assert.equal(res.status, 400);
  });

  test("GET /category/options is reachable (was shadowed by /:id)", async () => {
    const res = await server.request("GET", "/category/options");
    assert.equal(res.status, 200);
    assert.ok(res.json.categories.includes("fiction"));
  });

  test("invalid ObjectIds are rejected with 400 instead of a 500", async () => {
    const res = await server.request("GET", "/book/not-an-id");
    expectValidationError(res);
  });
});

describe("error handler", () => {
  const productionHandler = createErrorHandler({ isProduction: true });

  const fakeResponse = () => ({
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });

  test("hides internal error details and stack traces in production", (t) => {
    t.mock.method(console, "error", () => {});
    const res = fakeResponse();
    productionHandler(new Error("connection string leaked"), {}, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: "Internal server error" });
  });

  test("uses Error#cause as the HTTP status and keeps client error messages", () => {
    const res = fakeResponse();
    productionHandler(new Error("Empty Cart", { cause: 400 }), {}, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { message: "Empty Cart" });
  });

  test("development responses include the stack trace", () => {
    const res = fakeResponse();
    createErrorHandler({ isProduction: false })(new Error("Empty Cart", { cause: 400 }), {}, res, () => {});
    assert.ok(res.body.stack);
  });

  test("maps library errors to HTTP statuses through the rule table", () => {
    const named = (name, extra = {}) => Object.assign(new Error(name), { name, ...extra });
    assert.equal(resolveStatus(named("CastError")), 400);
    assert.equal(resolveStatus(named("MulterError")), 400);
    assert.equal(resolveStatus(named("TokenExpiredError")), 401);
    assert.equal(resolveStatus(named("MongoServerError", { code: 11000 })), 409);
    assert.equal(resolveStatus(Object.assign(new Error("too large"), { status: 413 })), 413);
    assert.equal(resolveStatus(new Error("unknown")), 500);
  });

  test("does not crash when cause is not a status code", () => {
    const res = fakeResponse();
    const err = new Error("boom", { cause: new Error("inner") });
    productionHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 500);
  });
});
