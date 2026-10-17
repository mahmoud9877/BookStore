import React from "react";
import useForm from "../../hooks/useForm.js";

const BOOK_FIELDS = ["bookTitle", "author", "description", "quantity", "price", "category"];
const INPUT_CLASS = "form-control book-input shadow-sm rounded-3";

const toFormValues = (book) => ({
  ...Object.fromEntries(BOOK_FIELDS.map((field) => [field, book?.[field] ?? ""])),
  image: null,
});

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Labelled input in the dashboard's style. */
function BookField({ name, label, className = "mb-4", as: Control = "input", ...controlProps }) {
  return (
    <div className={className}>
      <label htmlFor={`book-${name}`} className="form-label fw-bold">
        {label}
      </label>
      <Control id={`book-${name}`} name={name} className={INPUT_CLASS} {...controlProps} />
    </div>
  );
}

/**
 * Add/edit form for a book. Re-mount it (via `key`) to reset it.
 * `onSubmit` receives the multipart FormData the API expects.
 */
export default function BookForm({ book, categories, isSaving, error, onSubmit }) {
  const { values, handleChange } = useForm(toFormValues(book));
  const isEditing = Boolean(book);
  const field = (name) => ({ name, value: values[name], onChange: handleChange, required: true });

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData();
    BOOK_FIELDS.forEach((name) => formData.append(name, values[name]));
    if (values.image) formData.append("image", values.image);
    onSubmit(formData);
  }

  const submitLabel = isEditing
    ? isSaving ? "Updating Book..." : "Update Book"
    : isSaving ? "Adding Book..." : "Add Book";

  return (
    <form
      className="form m-auto w-100 pt-4 pb-4 px-3 shadow-lg rounded-3 bg-white"
      onSubmit={handleSubmit}
    >
      <div className="row">
        <BookField
          {...field("bookTitle")}
          className="col-md-6 mb-4"
          label="Name of the Book"
          type="text"
          placeholder="Enter the book title"
        />
        <BookField
          {...field("author")}
          className="col-md-6 mb-4"
          label="Author Name"
          type="text"
          placeholder="Enter the author's name"
        />
      </div>

      <BookField {...field("category")} as="select" label="Category">
        <option value="" disabled>
          Select a category
        </option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {capitalize(category)}
          </option>
        ))}
      </BookField>

      <BookField
        {...field("description")}
        as="textarea"
        label="Description"
        rows="3"
        placeholder="Enter a brief description of the book"
      />

      <div className="row">
        <BookField
          {...field("quantity")}
          className="col-md-6 mb-4"
          label="Quantity"
          type="number"
          placeholder="Enter the quantity"
        />
        <BookField
          {...field("price")}
          className="col-md-6 mb-4"
          label="Price $"
          type="number"
          placeholder="Enter the price"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="book-image" className="form-label fw-bold">
          Book Image
        </label>
        <input
          type="file"
          className="form-control book-input bg-light shadow-sm rounded-3"
          id="book-image"
          name="image"
          accept="image/jpeg,image/png,image/gif"
          onChange={handleChange}
        />
      </div>

      {error && <div className="alert alert-danger text-center">{error}</div>}

      <div className="d-flex justify-content-center">
        <button
          className="btn btn-primary book-button shadow-sm rounded-3 w-100"
          type="submit"
          disabled={isSaving}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
