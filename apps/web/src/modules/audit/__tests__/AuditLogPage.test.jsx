import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditLogPage from "../pages/AuditLogPage.jsx";
import { fakeApi, renderPage } from "../../../test-utils/render-page.jsx";
import { apiClient } from "../../../lib/api-client.js";

jest.mock("../../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

test("entries show the reason and expand to before/after values; filters reach the API", async () => {
  Object.assign(
    apiClient,
    fakeApi({
      "GET /auth/me": { user: { role: "Admin", permissions: ["audit:read"] } },
      "GET /audit-logs": {
        data: [{ _id: "a1", actorName: "Desk", action: "fine.waive", entity: "Fine", entityId: "f1", reason: "Goodwill", before: { waived: 0 }, after: { waived: 200 }, createdAt: "2026-10-22T10:00:00Z" }],
        meta: { page: 1, limit: 25, total: 1, pages: 1 },
      },
    })
  );
  renderPage(<AuditLogPage />, { path: "/dashboard/audit" });
  expect(await screen.findByText("Reason: Goodwill")).toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: /Show changes/ }));
  expect(await screen.findByText(/"waived": 200/)).toBeInTheDocument();

  userEvent.selectOptions(screen.getByLabelText("Record type"), "Fine");
  await screen.findByText("Reason: Goodwill");
  const last = apiClient.get.mock.calls.filter(([url]) => url === "/audit-logs").at(-1);
  expect(last[1].params.entity).toBe("Fine");
});
