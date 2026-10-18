import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "../auth/UserContext.jsx";
import * as cartApi from "./cart.service.js";

const CartContext = createContext(null);

/**
 * Single source of truth for the signed-in user's cart, shared by the header
 * badge, "Add to cart" buttons and the cart page. Empty when signed out.
 */
export function CartProvider({ children }) {
  const { userData } = useUser();
  const isSignedIn = Boolean(userData);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(isSignedIn);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!isSignedIn) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setItems(await cartApi.getCartItems());
      setError("");
    } catch {
      setError("We couldn't load your cart.");
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = useCallback(async (bookId, quantity = 1) => {
    await cartApi.addToCart(bookId, quantity);
    setItems(await cartApi.getCartItems());
  }, []);

  const remove = useCallback(async (bookId) => {
    await cartApi.removeFromCart(bookId);
    setItems((current) => current.filter((item) => String(item.bookId) !== String(bookId)));
  }, []);

  const clear = useCallback(async () => {
    await cartApi.clearCart();
    setItems([]);
  }, []);

  /** After an order is placed the server empties the cart; mirror it locally. */
  const markEmpty = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return { items, count, subtotal, isLoading, error, reload, add, remove, clear, markEmpty };
  }, [items, isLoading, error, reload, add, remove, clear, markEmpty]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
