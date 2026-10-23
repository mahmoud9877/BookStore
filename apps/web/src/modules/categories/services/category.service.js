import { apiClient, responseData } from "../../../lib/api-client.js";

/** Every category with its `bookCount`, sorted by name. */
export const listCategories = () => responseData(apiClient.get("/category"));

export const createCategory = (name) => responseData(apiClient.post("/category", { name }));

export const updateCategory = (categoryId, name) => responseData(apiClient.put(`/category/${categoryId}`, { name }));

export const deleteCategory = (categoryId) => apiClient.delete(`/category/${categoryId}`);
