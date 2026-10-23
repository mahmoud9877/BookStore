import userEvent from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";
import MembersPage from "./MembersPage.jsx";
import MemberDetailPage from "./MemberDetailPage.jsx";
import { validateMember } from "./MemberFormModal.jsx";
import { fakeApi, renderPage } from "../../test-utils/render-page.jsx";
import { apiClient } from "../../lib/api-client.js";

jest.mock("../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const PERMISSIONS = ["members:read", "members:manage", "payments:manage", "fines:manage", "circulation:manage", "reservations:manage"];
const MEMBER = {
  _id: "m1", memberNumber: "M-0000002", name: "Sara Ahmed", kind: "student", status: "active", isExpired: false, joinedAt: "2026-01-01",
  membershipType: { _id: "t1", name: "Student", loanLimit: 8 }, homeBranch: { _id: "b1", name: "Main Library" }, expiresAt: "2027-01-01",
  summary: { activeLoans: 1, overdueLoans: 1, activeReservations: 0, balance: 2500 },
};
const EMPTY_PAGE = { data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } };
const use = (routes) =>
  Object.assign(
    apiClient,
    fakeApi({
      "GET /auth/me": { user: { role: "Admin", permissions: PERMISSIONS } },
      "GET /branches/active": { data: [{ _id: "b1", name: "Main Library" }] },
      "GET /membership-types": { data: [{ _id: "t1", name: "Student", loanLimit: 8, loanPeriodDays: 21 }] },
      ...routes,
    })
  );

test("registering requires a name, type and home branch, and checks emails", async () => {
  expect(validateMember({ name: "", email: "x", phone: "12345", userEmail: "", membershipType: "", homeBranch: "" }, { isNew: true })).toEqual({
    name: "Enter the member's name.",
    email: "Enter a valid email address.",
    phone: "Enter a valid mobile number.",
    membershipType: "Choose a membership type.",
    homeBranch: "Choose the home branch.",
  });

  use({ "GET /members": EMPTY_PAGE, "POST /members": { data: { ...MEMBER, _id: "m9" } } });
  renderPage(<MembersPage />, { path: "/dashboard/members" });
  userEvent.click(await screen.findByRole("button", { name: /Register member/ }));
  const dialog = await screen.findByRole("dialog", { name: "Register a member" });
  userEvent.click(within(dialog).getByRole("button", { name: "Register" }));
  expect(await within(dialog).findByText("Choose a membership type.")).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();

  userEvent.type(within(dialog).getByLabelText("Name"), "Sara Ahmed");
  userEvent.selectOptions(await within(dialog).findByLabelText("Membership type"), "t1");
  userEvent.selectOptions(within(dialog).getByLabelText("Home branch"), "b1");
  userEvent.click(within(dialog).getByRole("button", { name: "Register" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/members", expect.objectContaining({ name: "Sara Ahmed", membershipType: "t1", homeBranch: "b1", kind: "individual" })));
});

describe("member page", () => {
  const renderMember = (routes = {}) => {
    use({
      "GET /members/m1": { data: MEMBER },
      "GET /loans": EMPTY_PAGE,
      ...routes,
    });
    return renderPage(<MemberDetailPage />, { path: "/dashboard/members/m1", route: "/dashboard/members/:memberId" });
  };

  test("suspending needs a reason", async () => {
    renderMember({ "POST /members/m1/suspend": { data: { ...MEMBER, status: "suspended" } } });
    userEvent.click(await screen.findByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("dialog", { name: "Suspend Sara Ahmed?" });
    userEvent.click(within(dialog).getByRole("button", { name: "Suspend" }));
    expect(await within(dialog).findByText(/Enter a reason/)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();

    userEvent.type(within(dialog).getByLabelText("Reason"), "Unpaid fines");
    userEvent.click(within(dialog).getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/members/m1/suspend", { reason: "Unpaid fines" }));
  });

  test("a cash payment is sent in minor units with an idempotency key", async () => {
    renderMember({ "POST /payments": { data: { _id: "p1", receiptNumber: "R-00000001" } } });
    userEvent.click(await screen.findByRole("button", { name: "Take payment" }));
    const dialog = await screen.findByRole("dialog", { name: "Record a cash payment" });
    userEvent.type(within(dialog).getByLabelText("Amount"), "30");
    userEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));
    expect(await within(dialog).findByText("The member owes EGP 25.00.")).toBeInTheDocument();

    userEvent.clear(within(dialog).getByLabelText("Amount"));
    userEvent.type(within(dialog).getByLabelText("Amount"), "12.5");
    userEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const [url, body, config] = apiClient.post.mock.calls[0];
    expect(url).toBe("/payments");
    expect(body).toEqual({ member: "m1", amount: 1250 });
    expect(config.headers["Idempotency-Key"]).toEqual(expect.any(String));
    expect(await screen.findByText("Payment recorded. Receipt R-00000001.")).toBeInTheDocument();
  });
});
