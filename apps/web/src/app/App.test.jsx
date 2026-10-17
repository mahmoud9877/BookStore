import React from "react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import App from "./App.jsx";
import { makeToken } from "../test-utils/make-token.js";
import * as authService from "../modules/auth/auth.service.js";
import * as bookService from "../modules/books/book.service.js";
import * as cartService from "../modules/cart/cart.service.js";
import * as orderService from "../modules/orders/order.service.js";

jest.mock("react-detect-offline", () => ({ Offline: () => null }));
jest.mock("../modules/auth/auth.service.js");
jest.mock("../modules/books/book.service.js");
jest.mock("../modules/cart/cart.service.js");
jest.mock("../modules/orders/order.service.js");

const BOOK = { _id: "b1", bookTitle: "dune", author: "frank herbert", price: 10, image: "" };

function renderAt(path, { token } = {}) {
  if (token) localStorage.setItem("userToken", token);
  const createRouter = (routes) => createMemoryRouter(routes, { initialEntries: [path] });
  return render(<App createRouter={createRouter} />);
}

beforeEach(() => {
  localStorage.clear();
  bookService.listBooks.mockResolvedValue([BOOK]);
  cartService.getCartItems.mockResolvedValue([]);
});

test("redirects anonymous visitors to the login page", async () => {
  renderAt("/");
  expect(await screen.findByText("Log-In")).toBeInTheDocument();
});

test("logging in stores the session and opens the home page", async () => {
  authService.login.mockResolvedValue({ message: "Done", token: makeToken(), role: "User" });
  renderAt("/login");

  userEvent.type(screen.getByLabelText("Email"), "reader@example.com");
  userEvent.type(screen.getByLabelText("Password"), "secret1");
  userEvent.click(screen.getByRole("button", { name: "Login" }));

  expect(await screen.findByText("Featured Books")).toBeInTheDocument();
  expect(await screen.findByText("dune")).toBeInTheDocument();
  expect(authService.login).toHaveBeenCalledWith({ email: "reader@example.com", password: "secret1" });
  expect(localStorage.getItem("userToken")).toBeTruthy();
});

test("shows the API's error message when login fails", async () => {
  authService.login.mockRejectedValue({ response: { data: { message: "Confirm Your Email" } } });
  renderAt("/login");

  userEvent.type(screen.getByLabelText("Email"), "reader@example.com");
  userEvent.type(screen.getByLabelText("Password"), "secret1");
  userEvent.click(screen.getByRole("button", { name: "Login" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Confirm Your Email");
});

test("expired sessions are discarded", async () => {
  renderAt("/", { token: makeToken({ exp: Date.now() / 1000 - 60 }) });
  expect(await screen.findByText("Log-In")).toBeInTheDocument();
  expect(localStorage.getItem("userToken")).toBeNull();
});

test("logout clears the session and returns to login", async () => {
  renderAt("/", { token: makeToken() });
  userEvent.click(await screen.findByRole("button", { name: /logout/i }));
  expect(await screen.findByText("Log-In")).toBeInTheDocument();
  expect(localStorage.getItem("userToken")).toBeNull();
});

test("the dashboard is only available to admins", async () => {
  renderAt("/dashboard", { token: makeToken({ role: "User" }) });
  expect(await screen.findByText("Featured Books")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
});

test("admins can open the dashboard from the header", async () => {
  renderAt("/", { token: makeToken({ role: "Admin" }) });
  userEvent.click(await screen.findByRole("link", { name: /dashboard/i }));
  expect(await screen.findByText("Book List")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Book" })).toBeInTheDocument();
});

test("unknown routes render the error page", async () => {
  renderAt("/no-such-page");
  expect(await screen.findByText("Page not found.")).toBeInTheDocument();
});

test("the profile page renders for signed-in users", async () => {
  renderAt("/profile", { token: makeToken({ userName: "reader" }) });
  expect(await screen.findByText("User Profile")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "reader" })).toBeInTheDocument();
});

test("a user without a cart sees an empty cart, not an error", async () => {
  renderAt("/cart", { token: makeToken() });
  expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
});

test("placing a cash order shows a confirmation and empties the cart", async () => {
  cartService.getCartItems.mockResolvedValue([
    { bookId: "b1", bookTitle: "dune", price: 10, quantity: 1, image: "" },
  ]);
  orderService.createOrder.mockResolvedValue({ message: "Order created successfully" });
  renderAt("/cart", { token: makeToken() });

  userEvent.click(await screen.findByRole("button", { name: "Place Order" }));
  userEvent.type(await screen.findByLabelText("Address"), "1 Nile St");
  userEvent.type(screen.getByLabelText("Phone"), "01012345678");
  userEvent.selectOptions(screen.getByLabelText("Payment method"), "cash");
  userEvent.click(screen.getByRole("button", { name: "Confirm Order" }));

  expect(await screen.findByText("Order placed successfully.")).toBeInTheDocument();
  expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
  expect(orderService.createOrder).toHaveBeenCalledWith({
    address: "1 Nile St",
    phone: "01012345678",
    note: "",
    paymentType: "cash",
  });
});

test("signup sends the user to login with a notice", async () => {
  authService.signup.mockResolvedValue({ message: "Done" });
  renderAt("/signup");

  userEvent.type(screen.getByLabelText("Name"), "reader");
  userEvent.type(screen.getByLabelText("Email"), "reader@example.com");
  userEvent.type(screen.getByLabelText("Password"), "secret1");
  userEvent.type(screen.getByLabelText("Confirm Password"), "secret1");
  userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

  expect(await screen.findByText(/Account created/)).toBeInTheDocument();
  expect(screen.getByText("Log-In")).toBeInTheDocument();
  expect(authService.signup).toHaveBeenCalledWith(
    expect.objectContaining({ userName: "reader", email: "reader@example.com" })
  );
});
