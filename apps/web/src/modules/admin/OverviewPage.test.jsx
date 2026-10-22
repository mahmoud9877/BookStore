import { screen } from "@testing-library/react";
import OverviewPage from "./OverviewPage.jsx";
import { fakeApi, renderPage } from "../../test-utils/render-page.jsx";
import { apiClient } from "../../lib/api-client.js";

jest.mock("../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const SUMMARY = {
  titles: 9, copies: { available: 18, on_loan: 4, in_transit: 1, lost: 1 }, activeLoans: 4, overdueLoans: 1,
  members: { active: 3, expired: 0, suspended: 1, cancelled: 0 }, openReservations: 2, outstandingFines: 2500, collectedThisMonth: 1000,
};

const use = (routes) => Object.assign(apiClient, fakeApi(routes));

test("staff with reports:read see the headline figures and their sections", async () => {
  use({ "GET /auth/me": { user: { role: "Admin", permissions: ["reports:read", "circulation:manage"] } }, "GET /reports/summary": { data: SUMMARY } });
  renderPage(<OverviewPage />, { path: "/dashboard" });
  expect(await screen.findByText("1 overdue")).toBeInTheDocument();
  expect(screen.getByText("EGP 25.00")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Circulation desk/ })).toHaveAttribute("href", "/dashboard/desk");
  expect(screen.queryByRole("link", { name: /Settings/ })).not.toBeInTheDocument();
});

test("without reports:read there are no figures, only shortcuts", async () => {
  use({ "GET /auth/me": { user: { role: "Desk", permissions: ["circulation:manage"] } } });
  renderPage(<OverviewPage />, { path: "/dashboard", claims: { role: "Desk", userName: "Desk" } });
  expect(await screen.findByRole("link", { name: /Loans/ })).toBeInTheDocument();
  expect(apiClient.get).not.toHaveBeenCalledWith("/reports/summary", expect.anything());
});
