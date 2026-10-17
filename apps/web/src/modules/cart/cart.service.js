import { apiClient } from "../../lib/api-client.js";

/** Returns the cart's items; a user without a cart yet has an empty one. */
export async function getCartItems() {
  try {
    return (await apiClient.get("/cart")).data.cart?.books ?? [];
  } catch (error) {
    if (error.response?.status === 404) return [];
    throw error;
  }
}

export const addToCart = (bookId, quantity = 1) =>
  apiClient.post("/cart/add", { bookId, quantity });

export const removeFromCart = (bookId) => apiClient.delete(`/cart/${bookId}`);

export const clearCart = () => apiClient.delete("/cart/clear");
