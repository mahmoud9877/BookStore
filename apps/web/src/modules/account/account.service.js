import { apiClient, responseData } from "../../lib/api-client.js";

/** Starts a card payment of all outstanding fines; resolves `{ payment, url }`. */
export const startFinePayment = async () => (await responseData(apiClient.post("/payments/me/checkout", {}))).data;

/** Sends the browser to the payment provider's hosted checkout. */
export const goToCheckout = (url) => window.location.assign(url);
