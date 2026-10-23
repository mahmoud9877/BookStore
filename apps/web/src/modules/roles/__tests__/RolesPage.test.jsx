import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RolesPage from "../pages/RolesPage.jsx";
import { fakeApi, renderPage } from "../../../test-utils/render-page.jsx";
import { apiClient } from "../../../lib/api-client.js";

jest.mock("../../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

test("roles are created with a branch scope; permissions are grouped", async () => {
  let created;
  Object.assign(
    apiClient,
    fakeApi({
      "GET /auth/me": { user: { role: "Admin", permissions: ["roles:manage"] } },
      "GET /role": { roles: [{ name: "Admin", permissions: [], isSystem: true, userCount: 1, branchScope: "all" }] },
      "GET /role/permissions": {
        permissions: [
          { key: "circulation:manage", group: "Circulation", label: "Circulation desk", description: "Loans." },
          { key: "reports:read", group: "Administration", label: "View reports", description: "Reports." },
        ],
      },
      "POST /role": ({ body }) => {
        created = body;
        return { role: { _id: "r1", ...body } };
      },
    })
  );
  renderPage(<RolesPage />, { path: "/dashboard/roles" });
  expect(await screen.findByText(/All branches/)).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "New role" }));
  const dialog = await screen.findByRole("dialog", { name: "New role" });
  expect(within(dialog).getByRole("group", { name: "Circulation" })).toBeInTheDocument();
  userEvent.type(within(dialog).getByLabelText("Name"), "Desk");
  userEvent.click(within(dialog).getByRole("checkbox", { name: /Circulation desk/ }));
  userEvent.click(within(dialog).getByRole("radio", { name: /All branches/ }));
  userEvent.click(within(dialog).getByRole("button", { name: "Create role" }));

  expect(await screen.findByText("Created the “Desk” role.")).toBeInTheDocument();
  expect(created).toMatchObject({ name: "Desk", permissions: ["circulation:manage"], branchScope: "all" });
});
