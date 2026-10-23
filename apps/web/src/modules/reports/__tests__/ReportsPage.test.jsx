import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportsPage from "../pages/ReportsPage.jsx";
import { fakeApi, renderPage } from "../../../test-utils/render-page.jsx";
import { apiClient } from "../../../lib/api-client.js";

jest.mock("../../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const SUMMARY = { titles: 9, copies: { available: 18, on_loan: 4 }, activeLoans: 4, overdueLoans: 1, members: { active: 3, expired: 0, suspended: 0, cancelled: 0 }, openReservations: 1, outstandingFines: 2500, collectedThisMonth: 0 };
const OVERDUE = {
  data: [{ loanId: "l1", title: "dune", barcode: "MAIN-1", memberNumber: "M-1", memberName: "Sara", branch: "MAIN", dueAt: "2026-10-13T00:00:00Z", daysOverdue: 9 }],
  meta: { page: 1, limit: 20, total: 1, pages: 1 },
};
const routes = (permissions) => ({
  "GET /auth/me": { user: { role: "Staff", permissions } },
  "GET /branches/active": { data: [{ _id: "b1", code: "MAIN", name: "Main Library" }] },
  "GET /reports/summary": { data: SUMMARY },
  "GET /reports/overdue": ({ params }) => (params?.format === "csv" ? new Blob(["title\r\n"]) : OVERDUE),
});

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:report");
  URL.revokeObjectURL = jest.fn();
});

test("the CSV export is requested as a blob with format=csv", async () => {
  Object.assign(apiClient, fakeApi(routes(["reports:read"])));
  renderPage(<ReportsPage />, { path: "/dashboard/reports" });
  userEvent.click(await screen.findByRole("tab", { name: "Overdue loans" }));
  expect(await screen.findByText("Sara (M-1)")).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: /Download CSV/ }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  const [url, config] = apiClient.get.mock.calls.find(([, options]) => options?.params?.format === "csv");
  expect(url).toBe("/reports/overdue");
  expect(config.responseType).toBe("blob");
});

test("the summary shows money in major units", async () => {
  Object.assign(apiClient, fakeApi(routes(["reports:read"])));
  renderPage(<ReportsPage />, { path: "/dashboard/reports" });
  expect(await screen.findByText("EGP 25.00")).toBeInTheDocument();
});

test("staff activity is only offered with audit:read", async () => {
  Object.assign(apiClient, fakeApi(routes(["reports:read"])));
  const { unmount } = renderPage(<ReportsPage />, { path: "/dashboard/reports" });
  await screen.findByText("EGP 25.00");
  expect(screen.queryByRole("tab", { name: "Staff activity" })).not.toBeInTheDocument();
  unmount();

  Object.assign(apiClient, fakeApi(routes(["reports:read", "audit:read"])));
  renderPage(<ReportsPage />, { path: "/dashboard/reports" });
  expect(await screen.findByRole("tab", { name: "Staff activity" })).toBeInTheDocument();
});
