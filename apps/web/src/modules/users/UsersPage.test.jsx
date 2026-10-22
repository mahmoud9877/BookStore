import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersPage from "./UsersPage.jsx";
import { fakeApi, renderPage } from "../../test-utils/render-page.jsx";
import { apiClient } from "../../lib/api-client.js";

jest.mock("../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const USERS = [
  { _id: "admin-1", userName: "Store Admin", email: "admin@example.com", role: "Admin", branches: [], isActive: true, confirmEmail: true },
  { _id: "u2", userName: "Reader", email: "reader@example.com", role: "Librarian", branches: ["b1"], isActive: true, confirmEmail: true },
];

function setup() {
  const patches = [];
  Object.assign(
    apiClient,
    fakeApi({
      "GET /auth/me": { user: { role: "Admin", permissions: ["users:manage", "users:read"] } },
      "GET /auth/user": { users: USERS, meta: { page: 1, limit: 25, total: 2, pages: 1 } },
      "GET /role": { roles: [{ name: "Admin" }, { name: "Librarian" }] },
      "GET /branches/active": { data: [{ _id: "b1", code: "MAIN", name: "Main Library" }, { _id: "b2", code: "EAST", name: "East Branch" }] },
      "PATCH /auth/user/u2/access": ({ body }) => {
        patches.push(body);
        return { user: { ...USERS[1], ...body } };
      },
    })
  );
  renderPage(<UsersPage />, { path: "/dashboard/users", claims: { id: "admin-1", role: "Admin", userName: "Store Admin" } });
  return patches;
}

test("searching asks the API, server side", async () => {
  setup();
  await screen.findByText("Reader");
  userEvent.type(screen.getByRole("searchbox", { name: "Search users" }), "rea");
  await waitFor(() => expect(apiClient.get.mock.calls.some(([url, config]) => url === "/auth/user" && config.params.search === "rea")).toBe(true));
});

test("assigning branches sends the chosen ids", async () => {
  const patches = setup();
  userEvent.click(await screen.findByRole("button", { name: "Branches of Reader" }));
  const dialog = await screen.findByRole("dialog", { name: "Branches for Reader" });
  userEvent.click(within(dialog).getByLabelText(/East Branch/));
  userEvent.click(within(dialog).getByRole("button", { name: "Save branches" }));
  expect(await screen.findByText("Updated Reader's branches.")).toBeInTheDocument();
  expect(patches[0]).toEqual({ branches: ["b1", "b2"] });
  expect(screen.queryByRole("button", { name: "Branches of Store Admin" })).not.toBeInTheDocument(); // not yourself
});

test("deactivating needs confirmation", async () => {
  const patches = setup();
  userEvent.click(await screen.findByRole("button", { name: "Deactivate Reader" }));
  const dialog = await screen.findByRole("dialog", { name: "Deactivate Reader?" });
  userEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
  expect(await screen.findByText("Reader was deactivated.")).toBeInTheDocument();
  expect(patches).toEqual([{ isActive: false }]);
});
