import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import BookForm from "../components/BookForm.jsx";
import BookList from "../components/BookList.jsx";
import { filterBooks } from "../utils/catalogue.js";
import Modal from "../../../components/ui/Modal.jsx";
import ModalFormActions from "../../../components/ui/ModalFormActions.jsx";
import { getErrorMessage } from "../../../lib/api-client.js";
import { formatTitle, pluralize } from "../../../lib/format.js";
import { toast } from "../../../components/ui/toast.store.js";
import { confirm } from "../../../components/ui/confirm.store.js";
import { useBooksQuery, useDeleteBook, useSaveBook } from "../queries/book.queries.js";
import { useCategoriesQuery } from "../../categories/queries/category.queries.js";
import StatePanel, { ErrorState } from "../../../components/ui/StatePanel.jsx";
import { t } from "../../../i18n/index.js";

const NEW_BOOK = Symbol("new book");
const NO_BOOKS = [];

/** Admin page: add, edit and delete books. */
export default function BooksDashboardPage() {
  const { data: books = NO_BOOKS, isLoading, error, refetch } = useBooksQuery();
  const { data: categories } = useCategoriesQuery();
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
      toast.success(editedBook ? t("Saved changes to “{title}”.", { title }) : t("Added “{title}” to the catalogue.", { title }));
      setEditing(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("Couldn't save this book. Please try again.")));
    }
  }

  async function handleDelete(book) {
    const title = formatTitle(book.bookTitle);
    const confirmed = await confirm({
      title: t("Delete this book?"),
      message: t("“{title}” will be removed from the catalogue. This can't be undone.", { title }),
      confirmLabel: t("Delete book"),
    });
    if (!confirmed) return;
    try {
      await removeBook.mutateAsync(book._id);
      toast.success(t("Deleted “{name}”.", { name: title }));
    } catch (err) {
      toast.error(getErrorMessage(err, t("Couldn't delete this book.")));
    }
  }

  return (
    <div className="container">
      <Helmet>
        <title>{t("Manage catalogue · BookSaw")}</title>
      </Helmet>
      <header className="page-header d-flex flex-wrap gap-3 align-items-end justify-content-between">
        <div>
          <h1>{t("Catalogue")}</h1>
          <p className="text-muted mb-0">
            {isLoading ? t("Loading…") : pluralize(books.length, "record")} · {t("one per edition; physical copies are managed under")}{" "}
            <Link to="/dashboard/copies">{t("Copies")}</Link>.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(NEW_BOOK)}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>{t("Add book")}
        </button>
      </header>

      <div className="card">
        <div className="card-body p-0">
          <div className="p-3 border-bottom">
            <input
              type="search"
              className="form-control"
              style={{ maxWidth: 360 }}
              placeholder={t("Search by title or author")}
              aria-label={t("Search the catalogue")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {isLoading ? (
            <p className="text-muted p-4 mb-0" aria-busy="true">
              {t("Loading the catalogue…")}
            </p>
          ) : error ? (
            <div className="p-3">
              <ErrorState message={getErrorMessage(error, t("Failed to fetch books."))} onRetry={refetch} />
            </div>
          ) : visibleBooks.length === 0 ? (
            <div className="p-3">
              <StatePanel
                icon={query ? "search" : "journal-plus"}
                title={query ? t("No books match your search") : t("Your catalogue is empty")}
                message={query ? t("Try a different title or author.") : t("Add your first book to start selling.")}
              />
            </div>
          ) : (
            <BookList books={visibleBooks} onEdit={setEditing} onDelete={handleDelete} />
          )}
        </div>
      </div>

      {editing && (
        <Modal
          title={editedBook ? t("Edit book") : t("Add a book")}
          onClose={closeEditor}
          footer={<ModalFormActions formId="book-form" onCancel={closeEditor} isPending={isSaving} submitLabel={editedBook ? t("Save changes") : t("Add book")} />}
        >
          <BookForm book={editedBook} categories={categories} onSubmit={handleSave} />
        </Modal>
      )}
    </div>
  );
}
