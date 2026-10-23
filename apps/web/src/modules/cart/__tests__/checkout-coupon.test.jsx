import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartPage from "../pages/CartPage.jsx";
import { fakeApi, renderPage } from "../../../test-utils/render-page.jsx";
import { apiClient } from "../../../lib/api-client.js";

jest.mock("../../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const LINE = { bookId: "b1", bookTitle: "dune", price: 288, originalPrice: 320, quantity: 2, image: "" };

function badRequest(message) {
  const error = new Error(message);
  error.response = { status: 400, data: { message } };
  return error;
}

beforeEach(() => {
  Object.assign(
    apiClient,
    fakeApi({
      "GET /cart": { cart: { books: [LINE] } },
      "POST /coupons/check": ({ body }) => {
        if (body.code !== "SAVE10") throw badRequest("Coupon not found");
        return { data: { code: "SAVE10", type: "percent", value: 10, subtotal: 576, discount: 57.6, total: 518.4 } };
      },
      "POST /order": { order: { _id: "650000000000000000abc123", subtotal: 576, discount: 57.6, coupon: { code: "SAVE10", discount: 57.6 }, finalPrice: 518.4 } },
    })
  );
});

test("cart lines on sale show the original price and the saving", async () => {
  renderPage(<CartPage />, { path: "/cart", claims: { role: "User" } });
  expect(await screen.findByText("−10%")).toBeInTheDocument();
  expect(screen.getByText(/EGP\s320/).tagName).toBe("DEL");
});

test("a coupon is checked against the cart, shown in the summary and sent with the order", async () => {
  renderPage(<CartPage />, { path: "/cart", claims: { role: "User" } });
  const summary = await screen.findByRole("complementary", { name: "Order summary" });

  userEvent.type(within(summary).getByLabelText("Coupon code"), "nope");
  userEvent.click(within(summary).getByRole("button", { name: "Apply" }));
  expect(await within(summary).findByText("Coupon not found")).toBeInTheDocument();

  userEvent.clear(within(summary).getByLabelText("Coupon code"));
  userEvent.type(within(summary).getByLabelText("Coupon code"), "SAVE10");
  userEvent.click(within(summary).getByRole("button", { name: "Apply" }));
  expect(await within(summary).findByText("Discount (SAVE10)")).toBeInTheDocument();
  expect(within(summary).getByText(/−EGP\s57\.6/)).toBeInTheDocument();
  expect(within(summary).getByText(/EGP\s518\.4/)).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledWith("/coupons/check", { code: "SAVE10" });

  userEvent.click(within(summary).getByRole("button", { name: "Checkout" }));
  userEvent.click(await screen.findByLabelText(/cash on delivery/i));
  userEvent.type(screen.getByLabelText("Delivery address"), "1 Nile Street, Cairo");
  userEvent.type(screen.getByLabelText("Mobile number"), "01012345678");
  userEvent.click(screen.getByRole("button", { name: /place order · EGP\s518\.4/i }));

  expect(await screen.findByText("Thank you — your order is placed!")).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledWith("/order", {
    address: "1 Nile Street, Cairo",
    phone: "+201012345678",
    note: "",
    paymentType: "cash",
    couponCode: "SAVE10",
  });
});

test("removing the coupon restores the full total", async () => {
  renderPage(<CartPage />, { path: "/cart", claims: { role: "User" } });
  const summary = await screen.findByRole("complementary", { name: "Order summary" });
  userEvent.type(within(summary).getByLabelText("Coupon code"), "SAVE10");
  userEvent.click(within(summary).getByRole("button", { name: "Apply" }));
  userEvent.click(await within(summary).findByRole("button", { name: "Remove coupon SAVE10" }));
  await waitFor(() => expect(within(summary).queryByText("Discount (SAVE10)")).not.toBeInTheDocument());
  expect(within(summary).getAllByText(/EGP\s576/)).toHaveLength(2); // subtotal + total
});

test("changing the cart clears the applied coupon", async () => {
  let lines = [LINE, { ...LINE, bookId: "b2", bookTitle: "sapiens", price: 410, originalPrice: 410, quantity: 1 }];
  Object.assign(
    apiClient,
    fakeApi({
      "GET /cart": () => ({ cart: { books: lines } }),
      "POST /coupons/check": { data: { code: "SAVE10", type: "percent", value: 10, subtotal: 986, discount: 98.6, total: 887.4 } },
      "DELETE /cart/b2": () => {
        lines = [LINE];
        return {};
      },
    })
  );
  renderPage(<CartPage />, { path: "/cart", claims: { role: "User" } });
  const summary = await screen.findByRole("complementary", { name: "Order summary" });
  userEvent.type(within(summary).getByLabelText("Coupon code"), "SAVE10");
  userEvent.click(within(summary).getByRole("button", { name: "Apply" }));
  expect(await within(summary).findByText("Discount (SAVE10)")).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Remove Sapiens from cart" }));
  await waitFor(() => expect(within(summary).queryByText("Discount (SAVE10)")).not.toBeInTheDocument());
  expect(within(summary).getByLabelText("Coupon code")).toBeInTheDocument();
});

test("a coupon can also be applied on the payment step, and Enter applies it without placing the order", async () => {
  renderPage(<CartPage />, { path: "/cart", claims: { role: "User" } });
  const summary = await screen.findByRole("complementary", { name: "Order summary" });
  userEvent.click(within(summary).getByRole("button", { name: "Checkout" }));
  userEvent.click(await screen.findByLabelText(/cash on delivery/i));
  expect(screen.getByRole("button", { name: /place order · EGP\s576/i })).toBeInTheDocument();

  userEvent.type(screen.getByLabelText("Coupon code"), "SAVE10{enter}");
  expect(await screen.findByText("Discount (SAVE10)")).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalledWith("/order", expect.anything());
  expect(screen.getByRole("button", { name: /place order · EGP\s518\.4/i })).toBeInTheDocument();

  userEvent.type(screen.getByLabelText("Delivery address"), "1 Nile Street, Cairo");
  userEvent.type(screen.getByLabelText("Mobile number"), "01012345678");
  userEvent.click(screen.getByRole("button", { name: /place order · EGP\s518\.4/i }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/order", expect.objectContaining({ couponCode: "SAVE10" })));
});
