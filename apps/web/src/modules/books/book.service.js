import { apiClient } from "../../lib/api-client.js";

export const listBooks = async () => (await apiClient.get("/book")).data.book ?? [];

export const getBook = async (bookId) => (await apiClient.get(`/book/${bookId}`)).data.book;

export const createBook = (formData) => apiClient.post("/book/add", formData);

export const updateBook = (bookId, formData) => apiClient.post(`/book/edit/${bookId}`, formData);

export const deleteBook = (bookId) => apiClient.delete(`/book/delete/${bookId}`);
