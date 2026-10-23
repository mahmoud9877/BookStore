import userEvent from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";
import CirculationDeskPage from "../pages/CirculationDeskPage.jsx";
import LoansPage from "../pages/LoansPage.jsx";
import { fakeApi, renderPage } from "../../../test-utils/render-page.jsx";
import { apiClient } from "../../../lib/api-client.js";

jest.mock("../../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const ME = { "GET /auth/me": { user: { role: "Admin", branchScope: "all", permissions: ["circulation:manage", "members:read"] } } };
const BRANCHES = { "GET /branches/active": { data: [{ _id: "b1", name: "Main Library" }] } };
const MEMBER = {
  _id: "m1", memberNumber: "M-0000001", name: "Sara Ahmed", status: "active", isExpired: false,
  membershipType: { name: "Student", loanLimit: 2 }, homeBranch: { name: "Main Library" }, expiresAt: "2027-01-01",
  summary: { activeLoans: 2, overdueLoans: 0, activeReservations: 0, balance: 0 },
};
const LOAN = { _id: "l1", book: { bookTitle: "dune" }, copy: { barcode: "MAIN-0000001" }, member: { _id: "m1", name: "Sara Ahmed" }, status: "active", dueAt: "2026-11-12T00:00:00Z", checkedOutAt: "2026-10-22T00:00:00Z" };

const use = (routes) => Object.assign(apiClient, fakeApi({ ...ME, ...BRANCHES, ...routes }));
const limitError = () => {
  const error = new Error("Forbidden");
  error.response = { status: 403, data: { message: "Loan limit reached (2)" } };
  return error;
};

describe("circulation desk", () => {
  test("a limit block can be overridden with a reason, which is sent to the API", async () => {
    let calls = 0;
    use({
      "GET /members/number/M-0000001": { data: MEMBER },
      "POST /loans/checkout": ({ body }) => {
        calls += 1;
        if (!body.overrideReason) throw limitError();
        return { data: LOAN };
      },
    });
    renderPage(<CirculationDeskPage />, { path: "/dashboard/desk" });

    userEvent.type(screen.getByLabelText("Member number"), "M-0000001");
    expect(await screen.findByText("Sara Ahmed")).toBeInTheDocument();
    userEvent.type(screen.getByLabelText("Copy barcode", { selector: "#checkout-barcode" }), "MAIN-0000001{enter}");

    expect(await screen.findByText("Loan limit reached (2)")).toBeInTheDocument();
    const override = screen.getByRole("button", { name: "Override and lend" });
    expect(override).toBeDisabled();
    userEvent.type(screen.getByLabelText(/Lend anyway/), "Exam week exception");
    userEvent.click(override);

    expect(await screen.findByText(/Lent “dune”/)).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(apiClient.post).toHaveBeenLastCalledWith("/loans/checkout", { barcode: "MAIN-0000001", member: "M-0000001", overrideReason: "Exam week exception" });
  });

  test("a return shows the fine and where the copy goes next", async () => {
    use({ "POST /loans/return": { data: { loan: LOAN, next: "held", fine: 750 } } });
    renderPage(<CirculationDeskPage />, { path: "/dashboard/desk" });

    userEvent.type(screen.getByLabelText("Copy barcode", { selector: "#return-barcode" }), "MAIN-0000001");
    userEvent.click(screen.getByRole("button", { name: "Return" }));

    await screen.findByText(/Returned “dune”/);
    const status = screen.getAllByRole("status").find((region) => /Returned/.test(region.textContent));
    expect(status).toHaveTextContent("EGP 7.50");
    expect(status).toHaveTextContent(/hold shelf/);
    expect(apiClient.post).toHaveBeenCalledWith("/loans/return", { barcode: "MAIN-0000001", damaged: false });
  });
});

describe("loans", () => {
  test("lists loans and declares one lost with a reason", async () => {
    use({ "GET /loans": { data: [LOAN], meta: { page: 1, limit: 20, total: 1, pages: 1 } }, "POST /loans/l1/lost": { data: { ...LOAN, status: "lost" } } });
    renderPage(<LoansPage />, { path: "/dashboard/loans" });

    userEvent.click(await screen.findByRole("button", { name: "Declare Dune lost" }));
    const dialog = await screen.findByRole("dialog", { name: "Declare this item lost?" });
    userEvent.type(within(dialog).getByLabelText(/Reason/), "Left on a train");
    userEvent.click(within(dialog).getByRole("button", { name: "Declare lost" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/loans/l1/lost", { reason: "Left on a train" }));
  });
});
