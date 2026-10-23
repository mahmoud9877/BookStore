import { apiClient, responseData } from "../../../lib/api-client.js";

/**
 * Checks a coupon against the signed-in user's cart (POST /coupons/check).
 * Resolves `{ code, type, value, subtotal, discount, total }`; a 400 carries the reason.
 */
export const checkCoupon = async (code) => (await responseData(apiClient.post("/coupons/check", { code: code.trim() }))).data;
