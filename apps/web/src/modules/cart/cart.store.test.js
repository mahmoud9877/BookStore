import * as cartApi from "./cart.service.js";
import { resetStores } from "../../test-utils/reset-stores.js";
import { selectCartCount, selectCartIsLoading, selectCartSubtotal, useCartStore } from "./cart.store.js";

jest.mock("./cart.service.js");

const ITEMS = [
  { bookId: "b1", price: 320, quantity: 2 },
  { bookId: "b2", price: 410, quantity: 1 },
];
const cart = () => useCartStore.getState();

beforeEach(() => resetStores());

test("starts loading until the first load completes, then derives count and subtotal", async () => {
  expect(selectCartIsLoading(cart())).toBe(true);
  cartApi.getCartItems.mockResolvedValue(ITEMS);

  await cart().load();

  expect(selectCartIsLoading(cart())).toBe(false);
  expect(selectCartCount(cart())).toBe(3);
  expect(selectCartSubtotal(cart())).toBe(1050);
});

test("a failed load reports an error", async () => {
  cartApi.getCartItems.mockRejectedValue(new Error("offline"));
  await cart().load();
  expect(cart()).toMatchObject({ status: "error", error: "We couldn't load your cart." });
});

test("add refreshes from the server; remove and clear update locally", async () => {
  cartApi.addToCart.mockResolvedValue({});
  cartApi.getCartItems.mockResolvedValue(ITEMS);
  await cart().add("b1", 2);
  expect(cartApi.addToCart).toHaveBeenCalledWith("b1", 2);
  expect(cart().items).toEqual(ITEMS);

  cartApi.removeFromCart.mockResolvedValue({});
  await cart().remove("b1");
  expect(cart().items.map((item) => item.bookId)).toEqual(["b2"]);

  cartApi.clearCart.mockResolvedValue({});
  await cart().clear();
  expect(cart().items).toEqual([]);
});

test("a load that finishes after sign-out is ignored", async () => {
  let resolveLoad;
  cartApi.getCartItems.mockReturnValue(new Promise((resolve) => (resolveLoad = resolve)));
  const pending = cart().load();
  cart().reset(); // signed out meanwhile
  resolveLoad(ITEMS);
  await pending;
  expect(cart().items).toEqual([]);
  expect(cart().status).toBe("idle");
});
