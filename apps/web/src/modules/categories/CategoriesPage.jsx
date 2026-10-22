import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import Joi from "joi";
import useForm from "../../hooks/useForm.js";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import FormField from "../../components/ui/FormField.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import { pluralize } from "../../lib/format.js";
import { toast } from "../../components/ui/toast.store.js";
import { confirm } from "../../components/ui/confirm.store.js";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";
import { useCategoriesQuery, useDeleteCategory, useSaveCategory } from "./category.queries.js";

const NEW_CATEGORY = Symbol("new category");
const categorySchema = Joi.object({
  name: Joi.string().trim().max(40).required().messages({ "string.empty": "Enter a category name." }),
});

function CategoryForm({ category, onSubmit }) {
  const { field, handleSubmit } = useForm({ name: category?.name ?? "" }, { schema: categorySchema });
  return (
    <form id="category-form" onSubmit={handleSubmit(({ name }) => onSubmit(name))} noValidate>
      <FormField label="Name" className="" autoComplete="off" {...field("name")} />
    </form>
  );
}

/** Admin page: categories and how many books each one has. */
export default function CategoriesPage() {
  const { data: categories, isLoading, error, refetch } = useCategoriesQuery();
  const saveCategory = useSaveCategory();
  const removeCategory = useDeleteCategory();
  const [editing, setEditing] = useState(null); // NEW_CATEGORY, a category, or null when closed
  const editedCategory = editing === NEW_CATEGORY ? null : editing;
  const isSaving = saveCategory.isPending;
  const closeEditor = () => !isSaving && setEditing(null);

  async function handleSave(name) {
    try {
      await saveCategory.mutateAsync({ categoryId: editedCategory?._id, name });
      toast.success(editedCategory ? `Renamed the category to “${name}”.` : `Added the “${name}” category.`);
      setEditing(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save this category."));
    }
  }

  async function handleDelete(category) {
    const confirmed = await confirm({
      title: "Delete this category?",
      message: `“${category.name}” will be removed. This can't be undone.`,
      confirmLabel: "Delete category",
    });
    if (!confirmed) return;
    try {
      await removeCategory.mutateAsync(category._id);
      toast.success(`Deleted “${category.name}”.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete this category."));
    }
  }

  return (
    <div className="container">
      <Helmet>
        <title>Categories · BookSaw</title>
      </Helmet>
      <header className="page-header d-flex flex-wrap gap-3 align-items-end justify-content-between">
        <div>
          <h1>Categories</h1>
          <p className="text-muted mb-0">
            {isLoading ? "Loading…" : `${pluralize(categories.length, "category", "categories")}. Each book belongs to one.`}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(NEW_CATEGORY)}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Add category
        </button>
      </header>

      <div className="card">
        {isLoading ? (
          <p className="text-muted p-4 mb-0" aria-busy="true">
            Loading categories…
          </p>
        ) : error ? (
          <div className="p-3">
            <ErrorState message={getErrorMessage(error, "Failed to fetch categories.")} onRetry={refetch} />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-3">
            <StatePanel icon="tags" title="No categories yet" message="Add a category before adding books." />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table data-table align-middle">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="text-end">
                    Books
                  </th>
                  <th scope="col" className="text-end">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category._id}>
                    <td className="fw-semibold text-capitalize">{category.name}</td>
                    <td className="text-end">
                      {category.bookCount > 0 ? (
                        <Link to={`/?category=${encodeURIComponent(category.name)}`}>{category.bookCount}</Link>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setEditing(category)}
                        aria-label={`Rename ${category.name}`}
                      >
                        <i className="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost-danger"
                        onClick={() => handleDelete(category)}
                        disabled={category.bookCount > 0}
                        title={category.bookCount > 0 ? "Move or delete its books first" : undefined}
                        aria-label={`Delete ${category.name}`}
                      >
                        <i className="bi bi-trash3" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editedCategory ? "Rename category" : "Add a category"}
          size="sm"
          onClose={closeEditor}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={closeEditor} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" form="category-form" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? <Spinner label="Saving" /> : editedCategory ? "Save" : "Add category"}
              </button>
            </>
          }
        >
          <CategoryForm category={editedCategory} onSubmit={handleSave} />
        </Modal>
      )}
    </div>
  );
}
