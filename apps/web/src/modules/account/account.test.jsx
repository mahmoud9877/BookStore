import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountLayout from "./AccountLayout.jsx";
import MyLoansPage from "./MyLoansPage.jsx";
import MyFinesPage from "./MyFinesPage.jsx";
import NotificationBell from "./NotificationBell.jsx";
import * as accountService from "./account.service.js";
import { apiClient } from "../../lib/api-client.js";
import { fakeApi, renderPage } from "../../test-utils/render-page.jsx";

jest.mock("../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});
jest.mock("./account.service.js", () => ({ ...jest.requireActual("./account.service.js"), goToCheckout: jest.fn() }));

const ME = { "GET /auth/me": { user: { role: "User", permissions: [] } } };
const MEMBER = { claims: { id: "u1", role: "User", userName: "reader" } };
const use = (routes) => Object.assign(apiClient, fakeApi({ ...ME, ...routes }));

const LOAN = {
  _id: "l1",
  book: { _id: "b1", bookTitle: "dune" },
  copy: { barcode: "MAIN-0000001" },
  branch: { name: "Main Library" },
  status: "active",
  checkedOutAt: "2026-10-01T10:00:00Z",
  dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  renewalsLeft: 2,
  accruedFine: 0,
};

test("an account without a library card explains how to get one", async () => {
  use({}); // GET /members/me is unknown to the fake: 404
  renderPage(<AccountLayout />, { path: "/account", ...MEMBER });
  expect(await screen.findByText("No library card is linked to this account")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Notifications/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Loans/ })).not.toBeInTheDocument();
});

test("members renew a loan and see the new due date", async () => {
  const newDue = "2026-12-01T10:00:00Z";
  use({
    "GET /loans/me": { data: [LOAN], meta: { page: 1, limit: 20, total: 1, pages: 1 } },
    "POST /loans/me/l1/renew": { data: { ...LOAN, dueAt: newDue, renewalsLeft: 1 } },
  });
  renderPage(<MyLoansPage />, { path: "/account/loans", ...MEMBER });
  userEvent.click(await screen.findByRole("button", { name: "Renew Dune" }));
  expect(await screen.findByText(/Renewed\. Now due Dec 1, 2026/)).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledWith("/loans/me/l1/renew");
});

test("paying online sends the member to the provider's checkout", async () => {
  use({
    "GET /fines/me": { data: { fines: [{ _id: "f1", type: "overdue", amount: 1500, paid: 0, waived: 0, balance: 1500, status: "outstanding", currency: "EGP", createdAt: "2026-10-01" }], balance: 1500, currency: "EGP" } },
    "GET /payments/me": { data: [] },
    "POST /payments/me/checkout": { data: { payment: { _id: "p1" }, url: "https://pay.example/cs_1" } },
  });
  renderPage(<MyFinesPage />, { path: "/account/fines", ...MEMBER });
  userEvent.click(await screen.findByRole("button", { name: /Pay EGP.15\.00 online/ }));
  await waitFor(() => expect(accountService.goToCheckout).toHaveBeenCalledWith("https://pay.example/cs_1"));
});

test("when card payments are not configured, members are told to pay at a desk", async () => {
  use({
    "GET /fines/me": { data: { fines: [], balance: 900, currency: "EGP" } },
    "GET /payments/me": { data: [] },
    "POST /payments/me/checkout": () => {
      const error = new Error("Service unavailable");
      error.response = { status: 503, data: { message: "Card payments are not configured" } };
      throw error;
    },
  });
  renderPage(<MyFinesPage />, { path: "/account/fines", ...MEMBER });
  userEvent.click(await screen.findByRole("button", { name: /online/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("You can pay at any branch desk");
});

test("the bell shows how many notifications are unread", async () => {
  use({ "GET /notifications/me": ({ params }) => ({ data: [], meta: {}, unread: params.unreadOnly ? 3 : 0 }) });
  renderPage(<NotificationBell />, { path: "/", ...MEMBER });
  const bell = await screen.findByRole("button", { name: "Notifications, 3 unread" });
  expect(within(bell).getByText("3")).toBeInTheDocument();
});
