// Authorization and validation on the library endpoints, through the real app
// (no database: requests are refused before any query runs).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { authenticateAs, expectValidationError, makeUser, useTestServer } from "./helpers.js";

const ID = "507f1f77bcf86cd799439011";

// Every staff endpoint, with the method it is called by.
const STAFF_ENDPOINTS = [
  ["GET", "/members"], ["POST", "/members"], ["POST", `/members/${ID}/suspend`], ["GET", "/members/number/M-0000001"],
  ["GET", "/loans"], ["POST", "/loans/checkout"], ["POST", "/loans/return"], ["POST", `/loans/${ID}/lost`],
  ["GET", "/reservations"], ["POST", "/reservations"],
  ["GET", "/copies"], ["POST", "/copies"], ["POST", `/copies/${ID}/status`], ["GET", "/copies/barcode/ABC-1"],
  ["GET", "/fines"], ["POST", "/fines"], ["POST", `/fines/${ID}/waive`],
  ["GET", "/payments"], ["POST", "/payments"], ["POST", `/payments/${ID}/refund`],
  ["GET", "/transfers"], ["POST", "/transfers"], ["POST", `/transfers/${ID}/receive`],
  ["GET", "/suppliers"], ["GET", "/purchase-orders"], ["POST", `/purchase-orders/${ID}/deliveries`],
  ["GET", "/stocktakes"], ["POST", "/stocktakes"],
  ["POST", "/branches"], ["GET", "/locations"], ["POST", "/authors"], ["POST", "/membership-types"],
  ["GET", "/rooms/bookings"], ["POST", "/events"], ["POST", "/digital"],
  ["GET", "/reports/summary"], ["GET", "/reports/overdue"], ["GET", "/reports/staff-activity"],
  ["GET", "/audit-logs"], ["GET", "/settings"], ["PUT", "/settings"],
  ["PATCH", `/auth/user/${ID}/access`],
];

describe("library endpoints: who may call them", () => {
  const server = useTestServer();

  test("anonymous requests get 401", async () => {
    for (const [method, path] of STAFF_ENDPOINTS) {
      assert.equal((await server.request(method, path)).status, 401, `${method} ${path}`);
    }
  });

  test("members (role User) get 403 on every staff endpoint", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("User"));
    for (const [method, path] of STAFF_ENDPOINTS) {
      assert.equal((await server.request(method, path, { headers })).status, 403, `${method} ${path}`);
    }
  });

  test("a role with only circulation rights cannot touch finance, settings or reports", async (t) => {
    t.mock.method(server.container.roleRepository, "findByName", async () => ({ name: "Desk", permissions: ["circulation:manage"], branchScope: "assigned" }));
    const headers = authenticateAs(t, server.container, makeUser("Desk"));
    for (const [method, path] of [["POST", "/payments"], ["POST", `/fines/${ID}/waive`], ["PUT", "/settings"], ["GET", "/reports/summary"], ["POST", "/members"]]) {
      assert.equal((await server.request(method, path, { headers })).status, 403, `${method} ${path}`);
    }
    // ...but reaches validation at the desk.
    expectValidationError(await server.request("POST", "/loans/checkout", { headers, body: { barcode: "" } }));
  });

  test("deactivated accounts are refused even with a valid token", async (t) => {
    const headers = authenticateAs(t, server.container, { ...makeUser("Admin"), isActive: false });
    const res = await server.request("GET", "/settings", { headers });
    assert.equal(res.status, 401);
    assert.match(res.json.message, /deactivated/);
  });
});

describe("library endpoints: request validation", () => {
  const server = useTestServer();

  test("settings reject unknown or out-of-range policies", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("Admin"));
    expectValidationError(await server.request("PUT", "/settings", { headers, body: { version: 0, fines: { overduePerDay: -5 } } }));
    expectValidationError(await server.request("PUT", "/settings", { headers, body: { version: 0, reservations: { holdPickupDays: 0 } } }));
  });

  test("payments need a positive whole amount in minor units", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("Admin"));
    expectValidationError(await server.request("POST", "/payments", { headers, body: { member: ID, amount: 12.5 } }));
    expectValidationError(await server.request("POST", "/payments", { headers, body: { member: ID, amount: 0 } }));
  });

  test("public catalogue search validates its filters", async () => {
    expectValidationError(await server.request("GET", "/catalog/search?limit=500"));
    expectValidationError(await server.request("GET", "/catalog/search?category=not-an-id"));
    expectValidationError(await server.request("GET", "/catalog/search?sort=random"));
  });

  test("the assistant needs a real question", async () => {
    expectValidationError(await server.request("POST", "/assistant/ask", { body: { question: "a" } }));
    const status = await server.request("GET", "/assistant/status");
    assert.deepEqual(status.json, { data: { ai: false } });
  });

  test("private documents are not served from /uploads", async () => {
    assert.equal((await server.request("GET", "/uploads/../private/digital/x.pdf")).status, 404);
  });
});
