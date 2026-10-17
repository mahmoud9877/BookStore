import { apiClient, responseData } from "../../lib/api-client.js";

/** The category names the API accepts for books (single source: the API). */
export const listCategoryOptions = async () =>
  (await responseData(apiClient.get("/category/options"))).categories ?? [];
