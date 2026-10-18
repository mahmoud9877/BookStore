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

jest.mock("react-detect-offline", () => ({ Offline: () => null }));
jest.mock("../modules/auth/auth.service.js");
jest.mock("../modules/books/book.service.js");
jest.mock("../modules/cart/cart.service.js");
jest.mock("../modules/orders/order.service.js");
jest.mock("../modules/categories/category.service.js");

const BOOKS = [
  { _id: "b1", bookTitle: "dune", author: "frank herbert", price: 320, quantity: 12, category: "fantasy", image: "", description: "Desert planet." },
  { _id: "b2", bookTitle: "sapiens", author: "yuval noah harari", price: 410, quantity: 3, category: "non-fiction", image: "" },
  { _id: "b3", bookTitle: "the hobbit", author: "j. r. r. tolkien", price: 250, quantity: 0, category: "fantasy", image: "" },
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
  bookService.getBook.mockResolvedValue(BOOKS[0]);
  cartService.getCartItems.mockResolvedValue([]);
  cartService.addToCart.mockResolvedValue({});
  cartService.clearCart.mockResolvedValue({});
  categoryService.listCategoryOptions.mockResolvedValue(["fantasy", "non-fiction"]);
});

describe("browsing", () => {
  test("anonymous visitors can browse the catalogue with formatted titles, authors and prices", async () => {
    renderAt("/");
    expect(await screen.findByRole("link", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByText("J. R. R. Tolkien")).toBeInTheDocument();
    expect(screen.getByText(/EGP\s320/)).toBeInTheDocument();
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add The Hobbit to cart" })).toBeDisabled();
  });

  test("search and category filters narrow the results and can be cleared", async () => {
    renderAt("/");
    await screen.findByRole("link", { name: "Dune" });

    userEvent.type(screen.getByRole("searchbox", { name: /search books/i }), "harari");
    expect(screen.getByRole("link", { name: "Sapiens" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dune" })).not.toBeInTheDocument();

    userEvent.click(screen.getByRole("button", { name: "fantasy" }));
    expect(await screen.findByText("No books match your search")).toBeInTheDocument();

    userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByRole("link", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByText("3 books")).toBeInTheDocument();
  });

  test("an anonymous add-to-cart asks the visitor to sign in", async () => {
    renderAt("/");
    userEvent.click(await screen.findByRole("button", { name: "Add Dune to cart" }));
    expect(await signInHeading()).toBeInTheDocument();
    expect(screen.getByText("Sign in to add books to your cart.")).toBeInTheDocument();
    expect(cartService.addToCart).not.toHaveBeenCalled();
  });

  test("signed-in shoppers get a confirmation and an updated cart badge", async () => {
    cartService.getCartItems.mockResolvedValueOnce([]).mockResolvedValue([CART_ITEM]);
    renderAt("/", { token: makeToken() });

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
    renderAt("/", { token: makeToken({ userName: "reader" }) });
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
    expect(screen.queryByText("Manage catalogue")).not.toBeInTheDocument();
  });
});

describe("cart and checkout", () => {
  test("an empty cart invites the shopper to browse", async () => {
    renderAt("/cart", { token: makeToken() });
    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Browse books" })).toHaveAttribute("href", "/");
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
    expect(screen.queryByRole("link", { name: "Manage catalogue" })).not.toBeInTheDocument();
  });

  test("admins see the catalogue table with stock status", async () => {
    renderAt("/dashboard", { token: adminToken() });
    expect(await screen.findByRole("heading", { name: "Catalogue" })).toBeInTheDocument();
    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("3 · low")).toBeInTheDocument();
  });

  test("editing a book pre-fills the form and saves through the modal", async () => {
    bookService.updateBook.mockResolvedValue({});
    renderAt("/dashboard", { token: adminToken() });

    userEvent.click(await screen.findByRole("button", { name: "Edit Dune" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit book" });
    expect(within(dialog).getByLabelText("Author")).toHaveValue("Frank Herbert");
    userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Saved changes to “Dune”.")).toBeInTheDocument();
    const [bookId, formData] = bookService.updateBook.mock.calls[0];
    expect(bookId).toBe("b1");
    expect(formData.get("author")).toBe("Frank Herbert");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("adding a book requires a cover and valid fields", async () => {
    renderAt("/dashboard", { token: adminToken() });
    userEvent.click(await screen.findByRole("button", { name: "Add book" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a book" });
    userEvent.click(within(dialog).getByRole("button", { name: "Add book" }));

    expect(await within(dialog).findByText("Enter the book's title.")).toBeInTheDocument();
    expect(within(dialog).getByText("Add a cover image.")).toBeInTheDocument();
    expect(bookService.createBook).not.toHaveBeenCalled();
  });

  test("deleting a book needs confirmation", async () => {
    bookService.deleteBook.mockResolvedValue({});
    renderAt("/dashboard", { token: adminToken() });

    userEvent.click(await screen.findByRole("button", { name: "Delete Dune" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this book?" });
    userEvent.click(within(dialog).getByRole("button", { name: "Delete book" }));

    expect(await screen.findByText("Deleted “Dune”.")).toBeInTheDocument();
    expect(bookService.deleteBook).toHaveBeenCalledWith("b1");
  });
});
