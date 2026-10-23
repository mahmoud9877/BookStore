import { apiClient, responseData } from "../../../lib/api-client.js";
import { fetchJson } from "../../../lib/resource.js";

export const listBooks = async () => (await responseData(apiClient.get("/book"))).book ?? [];

export const getBook = async (bookId) => (await responseData(apiClient.get(`/book/${bookId}`))).book;

export const createBook = (formData) => apiClient.post("/book/add", formData);

export const updateBook = (bookId, formData) => apiClient.post(`/book/edit/${bookId}`, formData);

export const deleteBook = (bookId) => apiClient.delete(`/book/delete/${bookId}`);

/** Catalogue search: `{ data: books (with availability), meta }`. */
export const searchCatalog = (params) => fetchJson("/catalog/search", params);

/** Other editions of the same title. */
export const listEditions = async (bookId) => (await fetchJson(`/book/${bookId}/editions`)).data ?? [];

/** Titles related by subject, author or category. */
export const listRelated = async (bookId) => (await fetchJson(`/catalog/${bookId}/related`)).data ?? [];
