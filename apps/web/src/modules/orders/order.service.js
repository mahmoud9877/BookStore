import { apiClient } from "../../lib/api-client.js";

/** Places an order for the current cart. Card orders resolve with a Stripe checkout `url`. */
export const createOrder = async ({ address, phone, note, paymentType }) =>
  (await apiClient.post("/order", { address, phone, note, paymentType })).data;
