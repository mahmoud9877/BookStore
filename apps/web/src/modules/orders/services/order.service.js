import { apiClient, responseData } from "../../../lib/api-client.js";

/**
 * Places an order for the current cart, with an optional `couponCode`.
 * Card orders resolve with a checkout `url`.
 */
export const createOrder = ({ address, phone, note, paymentType, couponCode }) =>
  responseData(apiClient.post("/order", { address, phone, note, paymentType, ...(couponCode ? { couponCode } : {}) }));
