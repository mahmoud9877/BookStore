import { API_BASE_URL } from "../config/api.js";

/** Covers stored on the API's own disk come back as "/uploads/…": make them absolute. */
export const coverUrl = (src) => (src?.startsWith("/uploads/") ? `${API_BASE_URL}${src}` : src);
