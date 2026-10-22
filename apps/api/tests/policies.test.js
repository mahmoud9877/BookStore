// Pure library rules and helpers: no database, no HTTP.
import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { daysLate, lostItemFee, overdueFine } from "../src/modules/finance/fine-policy.js";
import { MemberPolicy, addMonths } from "../src/modules/members/member-policy.js";
import { canAdjust } from "../src/modules/copies/copy-statuses.js";
import { isValidIsbn } from "../src/modules/books/isbn.js";
import { toCsv } from "../src/modules/reports/csv.js";
import { sanitize } from "../src/modules/audit/audit.service.js";
import { rateLimit } from "../src/middleware/rate-limit.js";
import { renderTemplate } from "../src/modules/notifications/notification.service.js";
import { withDefaults } from "../src/modules/settings/library-settings.js";
import { AccessContext } from "../src/core/access-context.js";
import { CatalogAssistantService, keywordsOf } from "../src/modules/assistant/assistant.service.js";

const DAY = 24 * 60 * 60 * 1000;

describe("fine policy", () => {
  const due = new Date("2026-03-01T12:00:00Z");
  const policy = { overduePerDay: 100, graceDays: 0, maxOverduePerLoan: null };

  test("partial days count as a whole day; on time is free", () => {
    assert.equal(daysLate(due, new Date(due.getTime() - 1)), 0);
    assert.equal(daysLate(due, new Date(due.getTime() + 1)), 1);
    assert.equal(daysLate(due, new Date(due.getTime() + 2 * DAY)), 2);
  });

  test("grace days and the cap apply", () => {
    const returnedAt = new Date(due.getTime() + 5 * DAY);
    assert.equal(overdueFine({ dueAt: due, returnedAt }, policy), 500);
    assert.equal(overdueFine({ dueAt: due, returnedAt }, { ...policy, graceDays: 2 }), 300);
    assert.equal(overdueFine({ dueAt: due, returnedAt }, { ...policy, maxOverduePerLoan: 250 }), 250);
  });

  test("defaults charge nothing until the library sets a fine", () => {
    const { fines } = withDefaults({});
    assert.equal(overdueFine({ dueAt: due, returnedAt: new Date(due.getTime() + 30 * DAY) }, fines), 0);
  });

  test("a lost item costs the flat fee if set, else the copy's cost", () => {
    assert.equal(lostItemFee({ cost: 4500 }, { lostItemFee: null }), 4500);
    assert.equal(lostItemFee({ cost: null }, { lostItemFee: null }), 0);
    assert.equal(lostItemFee({ cost: 4500 }, { lostItemFee: 2000 }), 2000);
  });
});

describe("membership", () => {
  test("months are added calendar-wise, clamping to month ends", () => {
    assert.equal(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10), "2026-02-28");
    assert.equal(addMonths(new Date("2026-03-15T00:00:00Z"), 12).toISOString().slice(0, 10), "2027-03-15");
  });

  test("only active, unexpired members are in good standing", () => {
    const future = new Date(Date.now() + DAY);
    assert.equal(MemberPolicy.blockReason({ status: "active", expiresAt: future }), null);
    assert.match(MemberPolicy.blockReason({ status: "suspended", statusReason: "Fines", expiresAt: future }), /suspended: Fines/);
    assert.match(MemberPolicy.blockReason({ status: "active", expiresAt: new Date(Date.now() - 1) }), /expired/);
  });
});

describe("inventory and catalogue rules", () => {
  test("workflow statuses cannot be set by hand", () => {
    assert.ok(canAdjust("available", "damaged"));
    assert.ok(canAdjust("missing", "available"));
    assert.equal(canAdjust("available", "on_loan"), false);
    assert.equal(canAdjust("on_loan", "lost"), false);
    assert.equal(canAdjust("withdrawn", "available"), false);
  });

  test("ISBN-10 and ISBN-13 check digits", () => {
    assert.ok(isValidIsbn("0-441-17271-7"));
    assert.ok(isValidIsbn("978-0-441-17271-9"));
    assert.ok(isValidIsbn("080442957X"));
    assert.equal(isValidIsbn("978-0-441-17271-0"), false);
    assert.equal(isValidIsbn("12345"), false);
  });
});

describe("branch access", () => {
  const assigned = new AccessContext({ permissions: ["loans"], branchScope: "assigned", branches: ["b1"] });
  const everywhere = new AccessContext({ permissions: [], branchScope: "all" });

  test("assigned staff act only on their branches", () => {
    assert.ok(assigned.canAccessBranch("b1"));
    assert.equal(assigned.canAccessBranch("b2"), false);
    assert.throws(() => assigned.assertBranch("b2"), { status: 403 });
    assert.deepEqual(assigned.branchFilter("branch"), { branch: { $in: ["b1"] } });
    assert.deepEqual(everywhere.branchFilter("branch"), {});
  });
});

describe("helpers", () => {
  test("CSV cells are quoted and spreadsheet formulas neutralised", () => {
    const csv = toCsv([{ a: 'x,"y"', b: "=HYPERLINK(1)", c: null }], ["a", "b", "c"]);
    assert.equal(csv, 'a,b,c\r\n"x,""y""",\'=HYPERLINK(1),\r\n');
  });

  test("audit entries never keep secrets", () => {
    const clean = sanitize({ email: "a@b.c", password: "hash", nested: { token: "t", card: "4242", ok: 1 }, __v: 0 });
    assert.deepEqual(clean, { email: "a@b.c", nested: { ok: 1 } });
  });

  test("templates fill known placeholders and blank unknown ones", () => {
    assert.equal(renderTemplate("Hi {{ name }}, {{missing}}due {{date}}", { name: "Ann", date: "May 1" }), "Hi Ann, due May 1");
  });

  test("the rate limiter allows `max` requests per window, then answers 429", () => {
    let now = 0;
    const limiter = rateLimit({ windowMs: 1000, max: 2, now: () => now });
    const req = { ip: "1.2.3.4" };
    const res = { set: mock.fn() };
    const results = [];
    for (let index = 0; index < 3; index += 1) limiter(req, res, (error) => results.push(error?.status ?? "ok"));
    now = 1001;
    limiter(req, res, (error) => results.push(error?.status ?? "ok"));
    assert.deepEqual(results, ["ok", "ok", 429, "ok"]);
  });
});

describe("catalogue assistant", () => {
  const books = [{ _id: "b1", bookTitle: "dune", author: "frank herbert", availability: { available: 1, total: 2 } }];
  const catalogService = { search: mock.fn(async () => ({ data: books })) };
  const categoryRepository = { list: async () => [{ _id: "c1", name: "science fiction" }] };

  test("without an AI provider it runs a keyword search", async () => {
    const service = new CatalogAssistantService({ catalogService, categoryRepository });
    const result = await service.ask({ question: "Can you recommend books about desert planets?" });
    assert.equal(result.mode, "keyword");
    assert.equal(catalogService.search.mock.calls.at(-1).arguments[0].q, "desert planets");
    assert.deepEqual(result.results, books);
  });

  test("with a model, recommendations are limited to records it was given", async () => {
    const catalogModel = {
      plan: async () => ({ query: "desert", category: "Science Fiction", language: null, yearFrom: null, yearTo: null, availableOnly: true }),
      answer: async () => ({ answer: "Try Dune.", recommendedIds: ["invented-id", "b1"] }),
    };
    const service = new CatalogAssistantService({ catalogService, categoryRepository, catalogModel });
    const result = await service.ask({ question: "sci-fi in the desert I can borrow today" });
    assert.equal(result.mode, "ai");
    assert.deepEqual(result.recommendedIds, ["b1"]);
    assert.deepEqual(result.filters, { q: "desert", category: "c1", available: true });
  });

  test("keywords drop filler words", () => {
    assert.equal(keywordsOf("I want some books by Tolkien, please!"), "tolkien");
  });
});
