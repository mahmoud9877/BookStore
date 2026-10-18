import React, { useEffect, useState } from "react";
import useForm from "../../hooks/useForm.js";
import { bookSchema } from "./book.validation.js";
import { CURRENCY } from "../../config/api.js";
import { formatTitle, formatName } from "../../lib/format.js";
import BookCover from "../../components/ui/BookCover.jsx";
import FormField from "../../components/ui/FormField.jsx";

const BOOK_FIELDS = ["bookTitle", "author", "description", "quantity", "price", "category"];

const toFormValues = (book) => ({
  bookTitle: book ? formatTitle(book.bookTitle) : "",
  author: book ? formatName(book.author) : "",
  description: book?.description ?? "",
  quantity: book?.quantity ?? "",
  price: book?.price ?? "",
  category: book?.category ?? "",
  image: null,
});

/** Object URL preview for a freshly chosen file, revoked when it changes. */
function useFilePreview(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

/**
 * Add/edit form for a book, rendered inside a modal. Submitted through the
 * modal footer button (form="book-form"). `onSubmit` receives multipart FormData.
 */
export default function BookForm({ book, categories, onSubmit }) {
  const isEditing = Boolean(book);
  const { values, handleChange, field, errors, handleSubmit } = useForm(toFormValues(book), {
    schema: bookSchema,
    validate: ({ image }) => (!isEditing && !image ? { image: "Add a cover image." } : {}),
  });
  const preview = useFilePreview(values.image);

  function submitBook() {
    const formData = new FormData();
    BOOK_FIELDS.forEach((name) => formData.append(name, values[name]));
    if (values.image) formData.append("image", values.image);
    onSubmit(formData);
  }

  return (
    <form id="book-form" onSubmit={handleSubmit(submitBook)} noValidate>
      <div className="row g-3">
        <div className="col-sm-7">
          <FormField label="Title" className="" {...field("bookTitle")} />
        </div>
        <div className="col-sm-5">
          <FormField label="Author" className="" {...field("author")} />
        </div>
        <div className="col-sm-6">
          <FormField label="Category" as="select" className="" {...field("category")}>
            <option value="">Choose…</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-6 col-sm-3">
          <FormField label={`Price (${CURRENCY})`} type="number" min="0" step="0.01" className="" {...field("price")} />
        </div>
        <div className="col-6 col-sm-3">
          <FormField label="In stock" type="number" min="1" step="1" className="" {...field("quantity")} />
        </div>
        <div className="col-12">
          <FormField label="Description" as="textarea" rows={3} className="" {...field("description")} />
        </div>
        <div className="col-12 d-flex gap-3 align-items-start">
          <BookCover src={preview ?? book?.image} alt="Cover preview" className="image-preview" />
          <div className="flex-grow-1">
            <label htmlFor="book-image" className="form-label">
              Cover image {isEditing && <span className="text-muted fw-normal">(optional)</span>}
            </label>
            <input
              id="book-image"
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/gif"
              className={`form-control ${errors.image ? "is-invalid" : ""}`}
              onChange={handleChange}
            />
            {errors.image ? (
              <div className="invalid-feedback">{errors.image}</div>
            ) : (
              <div className="form-text">JPEG, PNG or GIF. {isEditing && "Leave empty to keep the current cover."}</div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
