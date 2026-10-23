import { apiClient } from "../../../lib/api-client.js";
import { getCartItems } from "../services/cart.service.js";

test("treats a missing cart (404) as an empty cart", async () => {
  jest.spyOn(apiClient, "get").mockRejectedValue({ response: { status: 404 } });
  await expect(getCartItems()).resolves.toEqual([]);
});

test("propagates other errors", async () => {
  jest.spyOn(apiClient, "get").mockRejectedValue({ response: { status: 500 } });
  await expect(getCartItems()).rejects.toEqual({ response: { status: 500 } });
});
