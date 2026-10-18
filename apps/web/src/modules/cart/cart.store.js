import { create } from "zustand";
import * as cartApi from "./cart.service.js";

const initialState = {
  items: [],
  /** "idle" until the first load, then "loading" | "ready" | "error". */
  status: "idle",
  error: "",
};

let latestLoad = 0;

/** The signed-in user's cart. Kept in sync with the session by useCartSync(). */
export const useCartStore = create((set) => ({
  ...initialState,

  async load() {
    const call = ++latestLoad;
    set({ status: "loading", error: "" });
    try {
      const items = await cartApi.getCartItems();
      if (call === latestLoad) set({ items, status: "ready" });
    } catch {
      if (call === latestLoad) set({ status: "error", error: "We couldn't load your cart." });
    }
  },

  async add(bookId, quantity = 1) {
    await cartApi.addToCart(bookId, quantity);
    set({ items: await cartApi.getCartItems(), status: "ready" });
  },

  async remove(bookId) {
    await cartApi.removeFromCart(bookId);
    set((state) => ({ items: state.items.filter((item) => String(item.bookId) !== String(bookId)) }));
  },

  async clear() {
    await cartApi.clearCart();
    set({ items: [] });
  },

  /** After an order is placed the server empties the cart; mirror it locally. */
  markEmpty() {
    set({ items: [] });
  },

  /** Forget everything, e.g. on sign-out. */
  reset() {
    latestLoad++;
    set(initialState);
  },
}));

export const selectCartItems = (state) => state.items;
export const selectCartCount = (state) => state.items.reduce((sum, item) => sum + item.quantity, 0);
export const selectCartSubtotal = (state) =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
export const selectCartIsLoading = (state) => state.status === "idle" || state.status === "loading";
