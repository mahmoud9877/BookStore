import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "../pages/HomePage.jsx";
import BookDetailsPage from "../pages/BookDetailsPage.jsx";
import { apiClient } from "../../../lib/api-client.js";
import { fakeApi, renderPage } from "../../../test-utils/render-page.jsx";

jest.mock("../../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const BRANCHES = [
  { _id: "br1", name: "Main Library" },
  { _id: "br2", name: "East Branch" },
];
const DUNE = {
  _id: "b1",
  bookTitle: "dune",
  author: "frank herbert",
  description: "Desert planet.",
  isForSale: true,
  price: 320,
  quantity: 4,
  category: { _id: "c1", name: "fantasy" },
  availability: { total: 3, available: 2, byBranch: { br1: { total: 2, available: 2 }, br2: { total: 1, available: 0 } } },
};
const HOBBIT = { ...DUNE, _id: "b2", bookTitle: "the hobbit", author: "j. r. r. tolkien", isForSale: false, availability: { total: 1, available: 0 } };
const COMMON = {
  "GET /auth/me": { user: { role: "User", permissions: [] } },
  "GET /category": [{ _id: "c1", name: "fantasy", bookCount: 2 }],
  "GET /branches/active": { data: BRANCHES },
  "GET /assistant/status": { data: { ai: true } },
  "GET /cart": { cart: { books: [] } },
};
const use = (routes) => Object.assign(apiClient, fakeApi({ ...COMMON, ...routes }));

test("the home page searches the catalogue with the URL's filters and shows lending availability", async () => {
  use({ "GET /catalog/search": { data: [DUNE, HOBBIT], meta: { page: 1, limit: 24, total: 2, pages: 1 } } });
  renderPage(<HomePage />, { path: "/?q=desert&available=1&branch=br1", route: "/", claims: null });

  expect(await screen.findByText("2 of 3 available to borrow")).toBeInTheDocument();
  expect(screen.getByText("All 1 copy is out")).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith(
    "/catalog/search",
    { params: { q: "desert", available: true, branch: "br1", sort: "relevance", page: 1, limit: 24 } }
  );
  // Only titles for sale can go in the cart.
  expect(screen.getByRole("button", { name: "Add Dune to cart" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Add The Hobbit to cart" })).not.toBeInTheDocument();
});

test("the assistant answers and lists its recommendations first", async () => {
  use({
    "GET /catalog/search": { data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } },
    "POST /assistant/ask": ({ body }) => ({
      data: { answer: `For “${body.question}”, try The Hobbit.`, mode: "ai", recommendedIds: ["b2"], results: [HOBBIT, DUNE] },
    }),
  });
  renderPage(<HomePage />, { path: "/", claims: null });
  const panel = await screen.findByRole("region", { name: "Ask the catalogue" });
  expect(await within(panel).findByText("AI assistant")).toBeInTheDocument();
  userEvent.type(within(panel).getByLabelText("Describe what you are looking for"), "a gentle adventure");
  userEvent.click(within(panel).getByRole("button", { name: "Ask" }));

  expect(await within(panel).findByText("For “a gentle adventure”, try The Hobbit.")).toBeInTheDocument();
  const titles = within(panel).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
  expect(titles).toEqual(["The Hobbit", "Dune"]);
  expect(within(panel).getAllByText("Recommended")).toHaveLength(1);
});

test("members reserve a title for pickup at their home branch", async () => {
  use({
    "GET /book/b1": { message: "Done", book: DUNE },
    "GET /book/b1/editions": { data: [] },
    "GET /catalog/b1/related": { data: [HOBBIT] },
    "GET /members/me": { data: { _id: "m1", memberNumber: "M-1", homeBranch: { _id: "br2", name: "East Branch" } } },
    "POST /reservations/me": { data: { _id: "r1", status: "waiting", queuePosition: 2 } },
  });
  renderPage(<BookDetailsPage />, { path: "/book/b1", route: "/book/:bookId", claims: { id: "u1", role: "User", userName: "reader" } });

  await screen.findByText("2 of 2 on the shelf");
  const rows = screen.getAllByRole("listitem").map((item) => item.textContent);
  expect(rows).toEqual(expect.arrayContaining(["Main Library2 of 2 on the shelf", "East BranchAll 1 out"]));
  expect(await screen.findByRole("heading", { name: "You might also like" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("Pick up at")).toHaveValue("br2"));
  userEvent.click(screen.getByRole("button", { name: "Reserve" }));

  expect(await screen.findByText("Reserved: you are number 2 in the queue.")).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledWith("/reservations/me", { book: "b1", pickupBranch: "br2" });
});

test("reservation errors from the API are shown", async () => {
  use({
    "GET /book/b1": { message: "Done", book: DUNE },
    "GET /book/b1/editions": { data: [] },
    "GET /catalog/b1/related": { data: [] },
    "GET /members/me": { data: { _id: "m1", homeBranch: { _id: "br1" } } },
    "POST /reservations/me": () => {
      const error = new Error("Forbidden");
      error.response = { status: 403, data: { message: "Reservation limit reached (2)" } };
      throw error;
    },
  });
  renderPage(<BookDetailsPage />, { path: "/book/b1", route: "/book/:bookId", claims: { id: "u1", role: "User", userName: "reader" } });
  await waitFor(() => expect(screen.getByLabelText("Pick up at")).toHaveValue("br1"));
  userEvent.click(screen.getByRole("button", { name: "Reserve" }));
  expect(await screen.findByText("Reservation limit reached (2)")).toBeInTheDocument();
});
