import React, { useEffect, useState } from "react";
import useForm from "../../hooks/useForm.js";
import { bookSchema } from "./book.validation.js";
import { CURRENCY } from "../../config/api.js";
import { formatTitle, formatName } from "../../lib/format.js";
import BookCover from "../../components/ui/BookCover.jsx";
import FormField from "../../components/ui/FormField.jsx";
import { usePublisherOptions } from "./publisher.queries.js";

const BOOK_FIELDS = [
  "bookTitle", "author", "description", "category", "isbn", "edition", "publisher",
  "publicationYear", "language", "pageCount", "subjects", "keywords",
];

const toFormValues = (book) => ({
  bookTitle: book ? formatTitle(book.bookTitle) : "",
  author: book ? formatName(book.author) : "",
  description: book?.description ?? "",
  category: book?.category?._id ?? "",
  isbn: book?.isbn ?? "",
  edition: book?.edition ?? "",
  publisher: book?.publisher?._id ?? "",
  publicationYear: book?.publicationYear ?? "",
  language: book?.language ?? "",
  pageCount: book?.pageCount ?? "",
  subjects: (book?.subjects ?? []).join(", "),
  keywords: (book?.keywords ?? []).join(", "),
  isForSale: book?.isForSale ?? false,
  quantity: book?.quantity ?? "",
  price: book?.price ?? "",
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
  const publishers = usePublisherOptions();
  const { values, handleChange, field, errors, handleSubmit } = useForm(toFormValues(book), { schema: bookSchema });
  const preview = useFilePreview(values.image);

  function submitBook() {
    const formData = new FormData();
    BOOK_FIELDS.forEach((name) => formData.append(name, values[name] ?? ""));
    formData.append("isForSale", String(values.isForSale));
    // Library-only titles carry no shop price or stock.
    formData.append("price", values.isForSale ? values.price : 0);
    formData.append("quantity", values.isForSale ? values.quantity : 0);
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
              <option key={category._id} value={category._id}>
                {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-sm-6">
          <FormField label="Publisher" as="select" className="" {...field("publisher")}>
            <option value="">Not set</option>
            {publishers.map((publisher) => (
              <option key={publisher._id} value={publisher._id}>
                {publisher.name}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-sm-6">
          <FormField label="ISBN" className="" hint="ISBN-10 or ISBN-13; one record per edition." {...field("isbn")} />
        </div>
        <div className="col-6 col-sm-3">
          <FormField label="Edition" className="" {...field("edition")} />
        </div>
        <div className="col-6 col-sm-3">
          <FormField label="Year" type="number" className="" {...field("publicationYear")} />
        </div>
        <div className="col-6 col-sm-3">
          <FormField label="Language" className="" {...field("language")} />
        </div>
        <div className="col-6 col-sm-3">
          <FormField label="Pages" type="number" min="1" className="" {...field("pageCount")} />
        </div>
        <div className="col-sm-6">
          <FormField label="Subjects" className="" hint="Comma-separated" {...field("subjects")} />
        </div>
        <div className="col-sm-6">
          <FormField label="Keywords" className="" hint="Comma-separated" {...field("keywords")} />
        </div>
        <div className="col-12">
          <div className="form-check">
            <input
              id="book-for-sale"
              type="checkbox"
              className="form-check-input"
              checked={values.isForSale}
              onChange={(event) => handleChange({ target: { name: "isForSale", value: event.target.checked } })}
            />
            <label htmlFor="book-for-sale" className="form-check-label">
              For sale in the shop
            </label>
          </div>
        </div>
        {values.isForSale && (
          <>
            <div className="col-6 col-sm-3">
              <FormField label={`Price (${CURRENCY})`} type="number" min="0" step="0.01" className="" {...field("price")} />
            </div>
            <div className="col-6 col-sm-3">
              <FormField label="Shop stock" type="number" min="0" step="1" className="" {...field("quantity")} />
            </div>
          </>
        )}
        <div className="col-12">
          <FormField label="Description" as="textarea" rows={3} className="" {...field("description")} />
        </div>
        <div className="col-12 d-flex gap-3 align-items-start">
          <BookCover src={preview ?? book?.image} alt="Cover preview" className="image-preview" />
          <div className="flex-grow-1">
            <label htmlFor="book-image" className="form-label">
              Cover image <span className="text-muted fw-normal">(optional)</span>
            </label>
            <input
              id="book-image"
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className={`form-control ${errors.image ? "is-invalid" : ""}`}
              onChange={handleChange}
            />
            {errors.image ? (
              <div className="invalid-feedback">{errors.image}</div>
            ) : (
              <div className="form-text">JPEG, PNG, GIF or WebP. {isEditing && "Leave empty to keep the current cover."}</div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
