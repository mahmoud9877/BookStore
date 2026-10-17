import React, { useState } from "react";
import useBooks from "./useBooks.js";
import BookForm from "./BookForm.jsx";
import BookList from "./BookList.jsx";
import useAsyncData from "../../hooks/useAsyncData.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { createBook, deleteBook, updateBook } from "./book.service.js";
import { listCategoryOptions } from "../categories/category.service.js";
import "./BooksDashboardPage.css";

/** Admin page: add, edit and delete books. */
export default function BooksDashboardPage() {
  const { books, error: loadError, reload } = useBooks();
  const { data: categories } = useAsyncData(listCategoryOptions, { initialData: [] });
  const [selectedBook, setSelectedBook] = useState(null);
  const [formVersion, setFormVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  async function handleSave(formData) {
    setIsSaving(true);
    setActionError("");
    try {
      if (selectedBook) {
        await updateBook(selectedBook._id, formData);
        alert("Book updated successfully");
      } else {
        await createBook(formData);
        alert("Book added successfully");
      }
      await reload();
      setSelectedBook(null);
      setFormVersion((version) => version + 1); // re-mounts an empty form
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to save book. Please try again."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(book) {
    if (!window.confirm(`Delete "${book.bookTitle}"?`)) return;
    setActionError("");
    try {
      await deleteBook(book._id);
      alert("Book deleted successfully");
      await reload();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete book. Please try again."));
    }
  }

  return (
    <div className="books-manager">
      <BookForm
        key={`${selectedBook?._id ?? "new"}-${formVersion}`}
        book={selectedBook}
        categories={categories}
        isSaving={isSaving}
        error={actionError || loadError}
        onSubmit={handleSave}
      />
      <BookList books={books} onEdit={setSelectedBook} onDelete={handleDelete} />
    </div>
  );
}
