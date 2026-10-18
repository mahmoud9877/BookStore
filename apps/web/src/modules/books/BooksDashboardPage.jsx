import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import BookForm from "./BookForm.jsx";
import BookList from "./BookList.jsx";
import { filterBooks } from "./catalogue.js";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import { formatTitle, pluralize } from "../../lib/format.js";
import { toast } from "../../components/ui/toast.store.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { useBooksQuery, useDeleteBook, useSaveBook } from "./book.queries.js";
import { useCategoryOptions } from "../categories/category.queries.js";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";

const NEW_BOOK = Symbol("new book");
const NO_BOOKS = [];

/** Admin page: add, edit and delete books. */
export default function BooksDashboardPage() {
  const { data: books = NO_BOOKS, isLoading, error, refetch } = useBooksQuery();
  const categories = useCategoryOptions();
  const saveBook = useSaveBook();
  const removeBook = useDeleteBook();
  const isSaving = saveBook.isPending;
  const [editing, setEditing] = useState(null); // NEW_BOOK, a book, or null when closed
  const [query, setQuery] = useState("");

  const visibleBooks = useMemo(() => filterBooks(books, { query }), [books, query]);
  const editedBook = editing === NEW_BOOK ? null : editing;
  const closeEditor = () => !isSaving && setEditing(null);

  async function handleSave(formData) {
    try {
      await saveBook.mutateAsync({ bookId: editedBook?._id, formData });
      const title = formData.get("bookTitle");
      toast.success(editedBook ? `Saved changes to “${title}”.` : `Added “${title}” to the catalogue.`);
      setEditing(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save this book. Please try again."));
    }
  }

  async function handleDelete(book) {
    const title = formatTitle(book.bookTitle);
    const confirmed = await confirm({
      title: "Delete this book?",
      message: `“${title}” will be removed from the catalogue. This can't be undone.`,
      confirmLabel: "Delete book",
    });
    if (!confirmed) return;
    try {
      await removeBook.mutateAsync(book._id);
      toast.success(`Deleted “${title}”.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete this book."));
    }
  }

  return (
    <div className="container">
      <Helmet>
        <title>Manage catalogue · BookSaw</title>
      </Helmet>
      <header className="page-header d-flex flex-wrap gap-3 align-items-end justify-content-between">
        <div>
          <h1>Catalogue</h1>
          <p className="text-muted mb-0">{isLoading ? "Loading…" : pluralize(books.length, "book")}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(NEW_BOOK)}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Add book
        </button>
      </header>

      <div className="card">
        <div className="card-body p-0">
          <div className="p-3 border-bottom">
            <input
              type="search"
              className="form-control"
              style={{ maxWidth: 360 }}
              placeholder="Search by title or author"
              aria-label="Search the catalogue"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {isLoading ? (
            <p className="text-muted p-4 mb-0" aria-busy="true">
              Loading the catalogue…
            </p>
          ) : error ? (
            <div className="p-3">
              <ErrorState message={getErrorMessage(error, "Failed to fetch books.")} onRetry={refetch} />
            </div>
          ) : visibleBooks.length === 0 ? (
            <div className="p-3">
              <StatePanel
                icon={query ? "search" : "journal-plus"}
                title={query ? "No books match your search" : "Your catalogue is empty"}
                message={query ? "Try a different title or author." : "Add your first book to start selling."}
              />
            </div>
          ) : (
            <BookList books={visibleBooks} onEdit={setEditing} onDelete={handleDelete} />
          )}
        </div>
      </div>

      {editing && (
        <Modal
          title={editedBook ? "Edit book" : "Add a book"}
          onClose={closeEditor}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={closeEditor} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" form="book-form" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? <Spinner label="Saving" /> : editedBook ? "Save changes" : "Add book"}
              </button>
            </>
          }
        >
          <BookForm book={editedBook} categories={categories} onSubmit={handleSave} />
        </Modal>
      )}
    </div>
  );
}
