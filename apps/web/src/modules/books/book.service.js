import { apiClient, responseData } from "../../lib/api-client.js";

export const listBooks = async () => (await responseData(apiClient.get("/book"))).book ?? [];

export const getBook = async (bookId) => (await responseData(apiClient.get(`/book/${bookId}`))).book;

export const createBook = (formData) => apiClient.post("/book/add", formData);

export const updateBook = (bookId, formData) => apiClient.post(`/book/edit/${bookId}`, formData);

export const deleteBook = (bookId) => apiClient.delete(`/book/delete/${bookId}`);
