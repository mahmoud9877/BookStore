import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "./SettingsPage.jsx";
import { fakeApi, renderPage } from "../../test-utils/render-page.jsx";
import { apiClient } from "../../lib/api-client.js";

jest.mock("../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const SETTINGS = {
  version: 3,
  currency: "EGP",
  circulation: { blockBorrowingAboveBalance: null, allowRenewalWhenReserved: false, returnToHomeBranch: true },
  reservations: { holdPickupDays: 3, allowCrossBranchPickup: true },
  fines: { overduePerDay: 0, graceDays: 0, maxOverduePerLoan: null, lostItemFee: null, damagedItemFee: 0 },
  notifications: { emailEnabled: true, dueSoonDays: 2, membershipExpiryDays: 14, templates: { "loan.overdue": { subject: "Overdue", body: "Hi {{memberName}}" } } },
  rooms: { maxBookingHours: 4, maxAdvanceDays: 30, cancellationCutoffHours: 1 },
};

const ME = { user: { role: "Admin", permissions: ["settings:manage"] } };
const use = (routes) => Object.assign(apiClient, fakeApi({ "GET /auth/me": ME, "GET /settings": { data: SETTINGS }, ...routes }));

test("saving sends the version read and amounts in minor units", async () => {
  let sent;
  use({
    "PUT /settings": ({ body }) => {
      sent = body;
      return { data: { ...SETTINGS, version: 4, fines: { ...SETTINGS.fines, overduePerDay: 250 } } };
    },
  });
  renderPage(<SettingsPage />, { path: "/dashboard/settings" });

  const perDay = await screen.findByLabelText("Overdue fine per day (EGP)");
  userEvent.clear(perDay);
  userEvent.type(perDay, "2.5");
  userEvent.type(screen.getByLabelText("Block borrowing above balance (EGP)"), "10");
  userEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
  expect(sent.version).toBe(3);
  expect(sent.fines.overduePerDay).toBe(250);
  expect(sent.circulation.blockBorrowingAboveBalance).toBe(1000);
  expect(sent.fines.maxOverduePerLoan).toBeNull(); // empty stays "no cap"
});

test("a concurrent change (409) is explained, with a way to reload", async () => {
  use({
    "PUT /settings": () => {
      const error = new Error("conflict");
      error.response = { status: 409, data: { message: "Settings were changed by someone else. Reload and try again." } };
      throw error;
    },
  });
  renderPage(<SettingsPage />, { path: "/dashboard/settings" });
  userEvent.click(await screen.findByRole("button", { name: "Save settings" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("changed by someone else");
  userEvent.click(screen.getByRole("button", { name: "Reload settings" }));
  await waitFor(() => expect(apiClient.get.mock.calls.filter(([url]) => url === "/settings").length).toBeGreaterThan(1));
});

test("membership types can be created", async () => {
  let created;
  use({
    "GET /membership-types": { data: [], meta: { page: 1, limit: 100, total: 0, pages: 0 } },
    "POST /membership-types": ({ body }) => {
      created = body;
      return { data: { _id: "t1", ...body } };
    },
  });
  renderPage(<SettingsPage />, { path: "/dashboard/settings" });
  userEvent.click(await screen.findByRole("tab", { name: "Membership types" }));
  userEvent.click(await screen.findByRole("button", { name: /New type/ }));
  userEvent.type(await screen.findByLabelText("Code"), "STUDENT");
  userEvent.type(screen.getByLabelText("Name"), "Student");
  userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Saved “Student”.")).toBeInTheDocument();
  expect(created).toMatchObject({ code: "STUDENT", name: "Student", loanLimit: 5, loanPeriodDays: 14 });
});
