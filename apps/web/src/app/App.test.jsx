import React from "react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import App from "./App.jsx";
import { useAuthStore } from "../modules/auth/auth.store.js";
import { makeToken } from "../test-utils/make-token.js";
import { resetStores } from "../test-utils/reset-stores.js";
import { createQueryClient } from "../lib/query-client.js";
import * as authService from "../modules/auth/auth.service.js";
import * as bookService from "../modules/books/book.service.js";
import * as cartService from "../modules/cart/cart.service.js";
import * as orderService from "../modules/orders/order.service.js";
import * as categoryService from "../modules/categories/category.service.js";
import * as userService from "../modules/users/user.service.js";
import * as roleService from "../modules/roles/role.service.js";

jest.mock("react-detect-offline", () => ({ Offline: () => null }));
jest.mock("../modules/auth/auth.service.js");
jest.mock("../modules/books/book.service.js");
jest.mock("../modules/cart/cart.service.js");
jest.mock("../modules/orders/order.service.js");
jest.mock("../modules/categories/category.service.js");
jest.mock("../modules/users/user.service.js");
jest.mock("../modules/roles/role.service.js");
jest.mock("../modules/assistant/assistant.service.js", () => ({
  getAssistantStatus: async () => ({ ai: false }),
  askAssistant: jest.fn(),
}));
jest.mock("../modules/branches/branch.queries.js", () => ({
  useActiveBranches: () => ({ data: [{ _id: "br1", code: "MAIN", name: "Main Library" }], isLoading: false }),
}));

const FANTASY = { _id: "c00000000000000000000001", name: "fantasy" };
const NON_FICTION = { _id: "c00000000000000000000002", name: "non-fiction" };
const CATEGORIES = [
  { ...FANTASY, bookCount: 2 },
  { ...NON_FICTION, bookCount: 1 },
  { _id: "c00000000000000000000003", name: "poetry", bookCount: 0 },
];
const ALL_PERMISSIONS = ["books:manage", "categories:manage", "orders:manage", "users:read", "users:manage", "roles:manage"];
const BOOKS = [
  { _id: "b1", bookTitle: "dune", author: "frank herbert", price: 320, quantity: 12, category: FANTASY, image: "", description: "Desert planet." },
  { _id: "b2", bookTitle: "sapiens", author: "yuval noah harari", price: 410, quantity: 3, category: NON_FICTION, image: "" },
  { _id: "b3", bookTitle: "the hobbit", author: "j. r. r. tolkien", price: 250, quantity: 0, category: FANTASY, image: "" },
];
const CART_ITEM = { bookId: "b1", bookTitle: "dune", price: 320, quantity: 2, image: "" };

function renderAt(path, { token } = {}) {
  if (token) localStorage.setItem("userToken", token);
  useAuthStore.getState().syncFromStorage(); // the store read localStorage when the module loaded
  const createRouter = (routes) => createMemoryRouter(routes, { initialEntries: [path] });
  // A fresh cache per test, without retries, so tests are isolated and fail fast.
  const queryClient = createQueryClient({ queries: { retry: false } });
  return render(<App createRouter={createRouter} queryClient={queryClient} />);
}

/** Types into labelled fields, then clicks the named button. */
function fillAndSubmit(fields, buttonName) {
  Object.entries(fields).forEach(([label, text]) => userEvent.type(screen.getByLabelText(label), text));
  userEvent.click(screen.getByRole("button", { name: buttonName }));
}

const VALID_LOGIN = { Email: "reader@example.com", Password: "secret1" };
const signInHeading = () => screen.findByRole("heading", { name: "Sign in" });

beforeEach(() => {
  localStorage.clear();
  resetStores();
  bookService.listBooks.mockResolvedValue(BOOKS);
  // The home page searches on the server; emulate its text and category filters.
  bookService.searchCatalog.mockImplementation(async ({ q = "", category } = {}) => {
    const needle = q.toLowerCase();
    const data = BOOKS.filter((book) => !category || book.category._id === category).filter(
      (book) => !needle || `${book.bookTitle} ${book.author}`.includes(needle)
    );
    return { data, meta: { page: 1, limit: 24, total: data.length, pages: 1 } };
  });
  bookService.listEditions.mockResolvedValue([]);
  bookService.listRelated.mockResolvedValue([]);
  bookService.getBook.mockResolvedValue(BOOKS[0]);
  cartService.getCartItems.mockResolvedValue([]);
  cartService.addToCart.mockResolvedValue({});
  cartService.clearCart.mockResolvedValue({});
  categoryService.listCategories.mockResolvedValue(CATEGORIES);
  // GET /auth/me: the role's permissions, as the API resolves them.
  authService.getCurrentUser.mockImplementation(async () => {
    const { role } = useAuthStore.getState().user ?? {};
    return { role, permissions: role === "Admin" ? ALL_PERMISSIONS : [] };
  });
});

describe("landing page", () => {
  test("presents the product with working calls to action and section links", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: /Books, members, loans and branches/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Get started" })[0]).toHaveAttribute("href", "/signup");
    expect(screen.getAllByRole("link", { name: "Sign in" })[0]).toHaveAttribute("href", "/login");
    for (const name of ["Features", "How it works", "Benefits", "Who it's for", "About"]) {
      expect(screen.getAllByRole("link", { name })[0]).toBeInTheDocument();
    }
    expect(screen.getAllByText(/Illustration with sample data/)).toHaveLength(2); // both previews are labelled
    // Section links scroll within the page instead of changing the route.
    userEvent.click(screen.getAllByRole("link", { name: "Features" })[0]);
    expect(screen.getByRole("heading", { level: 1, name: /Books, members, loans and branches/ })).toBeInTheDocument();
  });

  test("old catalogue links (/?category=…) open the catalogue", async () => {
    renderAt("/?category=fantasy");
    expect(await screen.findByRole("heading", { name: "Find your next great read" })).toBeInTheDocument();
    await waitFor(() => expect(bookService.searchCatalog).toHaveBeenCalledWith(expect.objectContaining({ category: FANTASY._id })));
  });

  test("signed-in visitors are offered their workspace instead of sign-up", async () => {
    renderAt("/", { token: makeToken({ role: "Admin", userName: "Store Admin" }) });
    expect(await screen.findByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Get started" })).not.toBeInTheDocument();
  });
});

describe("browsing", () => {
  test("anonymous visitors can browse the catalogue with formatted titles, authors and prices", async () => {
    renderAt("/catalog");
    expect(await screen.findByRole("link", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByText("J. R. R. Tolkien")).toBeInTheDocument();
    expect(screen.getByText(/EGP\s320/)).toBeInTheDocument();
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add The Hobbit to cart" })).toBeDisabled();
  });

  test("search and category filters narrow the results and can be cleared", async () => {
    renderAt("/catalog");
    await screen.findByRole("link", { name: "Dune" });

    userEvent.type(screen.getByRole("searchbox", { name: /search books/i }), "harari");
    // The search runs on the server (debounced): wait for the narrowed results.
    await waitFor(() => expect(screen.queryByRole("link", { name: "Dune" })).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Sapiens" })).toBeInTheDocument();

    userEvent.click(screen.getByRole("button", { name: "fantasy" }));
    expect(await screen.findByText("No books match your search")).toBeInTheDocument();

    userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByRole("link", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByText("3 books")).toBeInTheDocument();
  });

  test("an anonymous add-to-cart asks the visitor to sign in", async () => {
    renderAt("/catalog");
    userEvent.click(await screen.findByRole("button", { name: "Add Dune to cart" }));
    expect(await signInHeading()).toBeInTheDocument();
    expect(screen.getByText("Sign in to add books to your cart.")).toBeInTheDocument();
    expect(cartService.addToCart).not.toHaveBeenCalled();
  });

  test("signed-in shoppers get a confirmation and an updated cart badge", async () => {
    cartService.getCartItems.mockResolvedValueOnce([]).mockResolvedValue([CART_ITEM]);
    renderAt("/catalog", { token: makeToken() });

    userEvent.click(await screen.findByRole("button", { name: "Add Dune to cart" }));

    expect(await screen.findByText("Added “Dune” to your cart.")).toBeInTheDocument();
    expect(cartService.addToCart).toHaveBeenCalledWith("b1", 1);
    expect(await screen.findByRole("link", { name: "Cart, 2 items" })).toBeInTheDocument();
  });

  test("the book page adds the chosen quantity", async () => {
    renderAt("/book/b1", { token: makeToken() });
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(await within(screen.getByRole("group", { name: "Quantity" })).findByText("2")).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    await waitFor(() => expect(cartService.addToCart).toHaveBeenCalledWith("b1", 2));
  });

  test("unknown routes show a not-found page inside the layout", async () => {
    renderAt("/no-such-page");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});

describe("accounts", () => {
  test("sign-in validates fields inline before calling the API", async () => {
    renderAt("/login");
    userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  test("signing in stores the session and shows the account menu", async () => {
    authService.login.mockResolvedValue({ message: "Done", token: makeToken({ userName: "reader" }), role: "User" });
    renderAt("/login");
    await signInHeading();
    fillAndSubmit(VALID_LOGIN, "Sign in");

    expect(await screen.findByRole("button", { name: "Account menu for reader" })).toBeInTheDocument();
    expect(authService.login).toHaveBeenCalledWith({ email: "reader@example.com", password: "secret1" });
    expect(localStorage.getItem("userToken")).toBeTruthy();
  });

  test("staff land in the workspace after signing in", async () => {
    authService.login.mockResolvedValue({ message: "Done", token: makeToken({ userName: "Store Admin", role: "Admin" }), role: "Admin" });
    renderAt("/login");
    await signInHeading();
    fillAndSubmit(VALID_LOGIN, "Sign in");
    expect(await screen.findByRole("heading", { name: "Welcome, Store Admin" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Workspace sections" })).toBeInTheDocument();
  });

  test("wrong credentials get a friendly message that doesn't reveal which part was wrong", async () => {
    authService.login.mockRejectedValue({ response: { data: { message: "Email Not found" } } });
    renderAt("/login");
    await signInHeading();
    fillAndSubmit(VALID_LOGIN, "Sign in");
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don't match.");
  });

  test("password visibility can be toggled", async () => {
    renderAt("/login");
    const password = await screen.findByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    userEvent.click(screen.getByRole("button", { name: "Show password" }));
    await waitFor(() => expect(password).toHaveAttribute("type", "text"));
  });

  test("signing up returns to sign-in with a notice", async () => {
    authService.signup.mockResolvedValue({ message: "Done" });
    renderAt("/signup");
    await screen.findByRole("heading", { name: "Create your account" });
    fillAndSubmit({ Name: "reader", Email: "reader@example.com", Password: "secret1", "Confirm password": "secret1" }, "Create account");

    expect(await screen.findByText(/Your account is ready/)).toBeInTheDocument();
    expect(authService.signup).toHaveBeenCalledWith(
      expect.objectContaining({ userName: "reader", email: "reader@example.com" })
    );
  });

  test("expired sessions are discarded and protected pages ask to sign in", async () => {
    renderAt("/cart", { token: makeToken({ exp: Date.now() / 1000 - 60 }) });
    expect(await signInHeading()).toBeInTheDocument();
    expect(localStorage.getItem("userToken")).toBeNull();
  });

  test("signing out from the account menu confirms it and clears the session", async () => {
    renderAt("/catalog", { token: makeToken({ userName: "reader" }) });
    userEvent.click(await screen.findByRole("button", { name: "Account menu for reader" }));
    userEvent.click(await screen.findByRole("button", { name: /sign out/i }));

    expect(await signInHeading()).toBeInTheDocument();
    expect(screen.getByText("You've been signed out.")).toBeInTheDocument();
    expect(localStorage.getItem("userToken")).toBeNull();
  });

  test("the profile shows the account and relevant links", async () => {
    renderAt("/profile", { token: makeToken({ userName: "reader" }) });
    expect(await screen.findByRole("heading", { name: "reader" })).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});

describe("cart and checkout", () => {
  test("an empty cart invites the shopper to browse", async () => {
    renderAt("/cart", { token: makeToken() });
    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Browse books" })).toHaveAttribute("href", "/catalog");
  });

  test("the summary shows line totals and the order total", async () => {
    cartService.getCartItems.mockResolvedValue([CART_ITEM, { ...CART_ITEM, bookId: "b2", bookTitle: "sapiens", price: 410, quantity: 1 }]);
    renderAt("/cart", { token: makeToken() });

    const summary = await screen.findByRole("complementary", { name: "Order summary" });
    expect(within(summary).getByText("Items (3)")).toBeInTheDocument();
    expect(within(summary).getAllByText(/EGP\s1,050/)).toHaveLength(2); // subtotal + total
    expect(screen.getByText(/EGP\s640/)).toBeInTheDocument(); // 2 × 320
  });

  test("checkout validates details, then places a cash order and shows a confirmation", async () => {
    cartService.getCartItems.mockResolvedValue([CART_ITEM]);
    orderService.createOrder.mockResolvedValue({ order: { _id: "650000000000000000abc123", finalPrice: 640 } });
    renderAt("/cart", { token: makeToken() });

    userEvent.click(await screen.findByRole("button", { name: "Checkout" }));
    userEvent.click(await screen.findByLabelText(/cash on delivery/i));
    userEvent.click(screen.getByRole("button", { name: /place order/i }));
    expect(await screen.findByText("Enter a delivery address.")).toBeInTheDocument();
    expect(orderService.createOrder).not.toHaveBeenCalled();

    userEvent.type(screen.getByLabelText("Delivery address"), "1 Nile Street, Cairo");
    userEvent.type(screen.getByLabelText("Phone"), "01012345678");
    userEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText("Thank you — your order is placed!")).toBeInTheDocument();
    expect(screen.getByText(/ABC123/)).toBeInTheDocument();
    expect(orderService.createOrder).toHaveBeenCalledWith({
      address: "1 Nile Street, Cairo",
      phone: "01012345678",
      note: "",
      paymentType: "cash",
    });
  });

  test("emptying the cart asks for confirmation first", async () => {
    cartService.getCartItems.mockResolvedValue([CART_ITEM]);
    // Like the real API: once cleared, the cart reads back empty.
    cartService.clearCart.mockImplementation(async () => cartService.getCartItems.mockResolvedValue([]));
    renderAt("/cart", { token: makeToken() });

    userEvent.click(await screen.findByRole("button", { name: "Empty cart" }));
    const dialog = await screen.findByRole("dialog", { name: "Empty your cart?" });
    userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(cartService.clearCart).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole("button", { name: "Empty cart" }));
    userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Empty cart" }));
    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(cartService.clearCart).toHaveBeenCalledTimes(1);
  });
});

describe("catalogue administration", () => {
  const adminToken = () => makeToken({ role: "Admin", userName: "Store Admin" });

  test("the dashboard is only available to admins", async () => {
    renderAt("/dashboard", { token: makeToken({ role: "User" }) });
    expect(await screen.findByRole("heading", { name: "Find your next great read" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  test("admins see the catalogue table with stock status", async () => {
    renderAt("/dashboard/books", { token: adminToken() });
    expect(await screen.findByRole("heading", { name: "Catalogue" })).toBeInTheDocument();
    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("3 · low")).toBeInTheDocument();
  });

  test("editing a book pre-fills the form and saves through the modal", async () => {
    bookService.updateBook.mockResolvedValue({});
    renderAt("/dashboard/books", { token: adminToken() });

    userEvent.click(await screen.findByRole("button", { name: "Edit Dune" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit book" });
    expect(within(dialog).getByLabelText("Author")).toHaveValue("Frank Herbert");
    userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Saved changes to “Dune”.")).toBeInTheDocument();
    const [bookId, formData] = bookService.updateBook.mock.calls[0];
    expect(bookId).toBe("b1");
    expect(formData.get("author")).toBe("Frank Herbert");
    expect(formData.get("category")).toBe(FANTASY._id); // books reference their category by id
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("adding a book validates its fields (the cover is optional)", async () => {
    renderAt("/dashboard/books", { token: adminToken() });
    userEvent.click(await screen.findByRole("button", { name: "Add book" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a book" });
    userEvent.click(within(dialog).getByRole("button", { name: "Add book" }));

    expect(await within(dialog).findByText("Enter the book's title.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Add a cover image.")).not.toBeInTheDocument();
    expect(bookService.createBook).not.toHaveBeenCalled();
  });

  test("deleting a book needs confirmation", async () => {
    bookService.deleteBook.mockResolvedValue({});
    renderAt("/dashboard/books", { token: adminToken() });

    userEvent.click(await screen.findByRole("button", { name: "Delete Dune" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this book?" });
    userEvent.click(within(dialog).getByRole("button", { name: "Delete book" }));

    expect(await screen.findByText("Deleted “Dune”.")).toBeInTheDocument();
    expect(bookService.deleteBook).toHaveBeenCalledWith("b1");
  });
});

describe("roles and permissions", () => {
  const adminToken = () => makeToken({ id: "admin-1", role: "Admin", userName: "Store Admin" });
  const ROLES = [
    { name: "Admin", permissions: ALL_PERMISSIONS, isSystem: true, userCount: 1 },
    { name: "User", permissions: [], isSystem: true, userCount: 1 },
    { _id: "r1", name: "Editor", description: "Catalogue staff", permissions: ["books:manage"], isSystem: false, userCount: 0 },
  ];
  const CATALOGUE = [
    { key: "books:manage", label: "Manage books", description: "Add, edit and delete books." },
    { key: "roles:manage", label: "Manage roles", description: "Edit roles." },
  ];

  beforeEach(() => {
    roleService.listRoles.mockResolvedValue(ROLES);
    roleService.listPermissions.mockResolvedValue(CATALOGUE);
    userService.listUsers.mockResolvedValue({
      users: [
        { _id: "admin-1", userName: "Store Admin", email: "admin@example.com", role: "Admin", confirmEmail: true, branches: [], isActive: true },
        { _id: "u2", userName: "Reader", email: "reader@example.com", role: "User", confirmEmail: true, branches: [], isActive: true },
      ],
      meta: { page: 1, limit: 25, total: 2, pages: 1 },
    });
  });

  test("a custom role only sees the sections its permissions allow", async () => {
    authService.getCurrentUser.mockResolvedValue({ role: "Category staff", permissions: ["categories:manage"] });
    renderAt("/dashboard", { token: makeToken({ role: "Category staff", userName: "Cat" }) });

    expect(await screen.findByRole("heading", { name: "Welcome, Cat" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Overview", "Categories"]);
  });

  test("a section the role does not grant redirects home", async () => {
    authService.getCurrentUser.mockResolvedValue({ role: "Category staff", permissions: ["categories:manage"] });
    renderAt("/dashboard/roles", { token: makeToken({ role: "Category staff" }) });
    expect(await screen.findByRole("heading", { name: "Find your next great read" })).toBeInTheDocument();
  });

  test("categories show their book count and only empty ones can be deleted", async () => {
    renderAt("/dashboard/categories", { token: adminToken() });
    expect(await screen.findByRole("link", { name: "2" })).toHaveAttribute("href", "/catalog?category=fantasy");
    expect(screen.getByRole("button", { name: "Delete fantasy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete poetry" })).toBeEnabled();
  });

  test("adding a category", async () => {
    categoryService.createCategory.mockResolvedValue({});
    renderAt("/dashboard/categories", { token: adminToken() });
    userEvent.click(await screen.findByRole("button", { name: "Add category" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a category" });
    userEvent.type(within(dialog).getByLabelText("Name"), "history");
    userEvent.click(within(dialog).getByRole("button", { name: "Add category" }));

    expect(await screen.findByText("Added the “history” category.")).toBeInTheDocument();
    expect(categoryService.createCategory).toHaveBeenCalledWith("history");
  });

  test("admins change another account's role, but not their own", async () => {
    userService.changeUserRole.mockResolvedValue({});
    renderAt("/dashboard/users", { token: adminToken() });

    const select = await screen.findByRole("combobox", { name: "Role of Reader" });
    expect(screen.queryByRole("combobox", { name: "Role of Store Admin" })).not.toBeInTheDocument();
    userEvent.selectOptions(select, "Editor");

    expect(await screen.findByText("Reader is now Editor.")).toBeInTheDocument();
    expect(userService.changeUserRole).toHaveBeenCalledWith("u2", "Editor");
  });

  test("creating a role with chosen permissions; built-in roles are read-only", async () => {
    roleService.createRole.mockResolvedValue({});
    renderAt("/dashboard/roles", { token: adminToken() });

    expect(await screen.findByRole("heading", { name: "Editor" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);

    userEvent.click(screen.getByRole("button", { name: "New role" }));
    const dialog = await screen.findByRole("dialog", { name: "New role" });
    userEvent.type(within(dialog).getByLabelText("Name"), "Support");
    userEvent.click(within(dialog).getByRole("checkbox", { name: /Manage books/ }));
    userEvent.click(within(dialog).getByRole("button", { name: "Create role" }));

    expect(await screen.findByText("Created the “Support” role.")).toBeInTheDocument();
    expect(roleService.createRole).toHaveBeenCalledWith({ name: "Support", description: "", permissions: ["books:manage"], branchScope: "assigned" });
  });
});
