import { apiClient, responseData } from "../../lib/api-client.js";

/** Places an order for the current cart. Card orders resolve with a checkout `url`. */
export const createOrder = ({ address, phone, note, paymentType }) =>
  responseData(apiClient.post("/order", { address, phone, note, paymentType }));
