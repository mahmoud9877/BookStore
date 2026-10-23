import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CouponsPage from "./CouponsPage.jsx";
import { fakeApi, renderPage } from "../../test-utils/render-page.jsx";
import { apiClient } from "../../lib/api-client.js";

jest.mock("../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const COUPONS = [
  { _id: "c1", code: "SAVE20", type: "percent", value: 20, minOrder: 0, expiresAt: null, maxUses: null, usedCount: 3, isActive: true },
  { _id: "c2", code: "WELCOME50", type: "fixed", value: 50, minOrder: 200, expiresAt: "2020-01-01T00:00:00.000Z", maxUses: 100, usedCount: 7, isActive: true },
];

test("coupons list their discount, uses and status; new ones are created with numbers and nulls", async () => {
  const create = jest.fn(({ body }) => ({ data: { _id: "c3", ...body, usedCount: 0 } }));
  Object.assign(
    apiClient,
    fakeApi({
      "GET /auth/me": { user: { role: "Admin", permissions: ["orders:manage"] } },
      "GET /coupons": { data: COUPONS, meta: { page: 1, limit: 25, total: 2, pages: 1 } },
      "POST /coupons": create,
    })
  );
  renderPage(<CouponsPage />, { path: "/dashboard/coupons" });

  const row = await screen.findByRole("row", { name: /SAVE20/ });
  expect(within(row).getByText("20%")).toBeInTheDocument();
  expect(within(row).getByText("3 / ∞")).toBeInTheDocument();
  expect(within(row).getByText("Active")).toBeInTheDocument();
  const expired = screen.getByRole("row", { name: /WELCOME50/ });
  expect(within(expired).getByText(/EGP\s50/)).toBeInTheDocument();
  expect(within(expired).getByText("7 / 100")).toBeInTheDocument();
  expect(within(expired).getByText("Expired")).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Add coupon" }));
  const dialog = await screen.findByRole("dialog");
  userEvent.type(within(dialog).getByLabelText("Code"), "spring10");
  userEvent.selectOptions(within(dialog).getByLabelText("Discount type"), "percent");
  userEvent.type(within(dialog).getByLabelText("Discount value"), "10");
  userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

  await waitFor(() => expect(create).toHaveBeenCalled());
  expect(create.mock.calls[0][0].body).toEqual({
    code: "SPRING10",
    type: "percent",
    value: 10,
    minOrder: 0,
    maxUses: null,
    expiresAt: null,
    isActive: true,
  });
});
