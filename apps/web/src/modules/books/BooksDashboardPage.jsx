import React, { useState } from "react";
import useBooks from "./useBooks.js";
import { createBook, deleteBook, updateBook } from "./book.service.js";
import { getErrorMessage } from "../../lib/api-client.js";
import "./BooksDashboardPage.css";

const EMPTY_FORM = {
  bookTitle: "",
  author: "",
  description: "",
  quantity: "",
  price: "",
  category: "",
  image: null,
};

const TEXT_FIELDS = ["bookTitle", "author", "description", "quantity", "price", "category"];

export default function BooksDashboardPage() {
  const { books, error: loadError, reload } = useBooks();
  const [bookForm, setBookForm] = useState(EMPTY_FORM);
  const [selectedBook, setSelectedBook] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const error = actionError || loadError;

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setBookForm((current) => ({ ...current, [name]: files ? files[0] : value }));
  };

  const resetForm = () => {
    setBookForm(EMPTY_FORM);
    setSelectedBook(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setActionError("");
    const formData = new FormData();
    TEXT_FIELDS.forEach((field) => formData.append(field, bookForm[field]));
    if (bookForm.image) formData.append("image", bookForm.image);

    try {
      if (selectedBook) {
        await updateBook(selectedBook._id, formData);
        alert("Book updated successfully");
      } else {
        await createBook(formData);
        alert("Book added successfully");
      }
      await reload();
      resetForm();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to save book. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleUpdateClick = (book) => {
    setSelectedBook(book);
    setBookForm({
      bookTitle: book.bookTitle,
      author: book.author,
      description: book.description,
      price: book.price,
      quantity: book.quantity,
      category: book.category,
      image: null,
    });
  };

  return (
    <div className="books-manager">
      <form
        className="form m-auto w-100 pt-4 pb-4 px-3 shadow-lg rounded-3 bg-white"
        onSubmit={handleSubmit}
      >
        <div className="row">
          <div className="col-md-6 mb-4">
            <label htmlFor="book-bookTitle" className="form-label fw-bold">Name of the Book</label>
            <input
              type="text"
              className="form-control book-input shadow-sm rounded-3"
              id="book-bookTitle"
              name="bookTitle"
              value={bookForm.bookTitle}
              onChange={handleInputChange}
              placeholder="Enter the book title"
              required
            />
          </div>

          <div className="col-md-6 mb-4">
            <label htmlFor="book-author" className="form-label fw-bold">Author Name</label>
            <input
              type="text"
              className="form-control book-input shadow-sm rounded-3"
              id="book-author"
              name="author"
              value={bookForm.author}
              onChange={handleInputChange}
              placeholder="Enter the author's name"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="category" className="form-label fw-bold">Category</label>
          <select
            id="category"
            name="category"
            className="form-control book-input shadow-sm rounded-3"
            value={bookForm.category}
            onChange={handleInputChange}
            required
          >
            <option value="" disabled>
              Select a category
            </option>
            <option value="fantasy">Fantasy</option>
            <option value="biography">Biography</option>
            <option value="science">Science</option>
            <option value="non-fiction">Non-fiction</option>
            <option value="fiction">Fiction</option>
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="book-description" className="form-label fw-bold">Description</label>
          <textarea
            className="form-control book-input shadow-sm rounded-3"
            id="book-description"
            name="description"
            rows="3"
            value={bookForm.description}
            onChange={handleInputChange}
            placeholder="Enter a brief description of the book"
            required
          ></textarea>
        </div>

        <div className="row">
          <div className="col-md-6 mb-4">
            <label htmlFor="book-quantity" className="form-label fw-bold">Quantity</label>
            <input
              type="number"
              className="form-control book-input shadow-sm rounded-3"
              id="book-quantity"
              name="quantity"
              value={bookForm.quantity}
              onChange={handleInputChange}
              placeholder="Enter the quantity"
              required
            />
          </div>

          <div className="col-md-6 mb-4">
            <label htmlFor="book-price" className="form-label fw-bold">Price $</label>
            <input
              type="number"
              className="form-control book-input shadow-sm rounded-3"
              id="book-price"
              name="price"
              value={bookForm.price}
              onChange={handleInputChange}
              placeholder="Enter the price"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="book-image" className="form-label fw-bold">Book Image</label>
          <input
            type="file"
            className="form-control book-input bg-light shadow-sm rounded-3"
            id="book-image"
            name="image"
            onChange={handleInputChange}
          />
        </div>

        {error && <div className="alert alert-danger text-center">{error}</div>}

        <div className="d-flex justify-content-center">
          <button
            className="btn btn-primary book-button shadow-sm rounded-3 w-100"
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? selectedBook
                ? "Updating Book..."
                : "Adding Book..."
              : selectedBook
              ? "Update Book"
              : "Add Book"}
          </button>
        </div>
      </form>

      {/* Book List Display */}
      <div className="book-list">
        <h3>Book List</h3>
        <ul>
          {books.map((book) => (
            <li key={book._id}>
              <div>
                <strong>{book.bookTitle}</strong> by {book.author}
              </div>
              <div>
                <button type="button" onClick={() => handleUpdateClick(book)}>Edit</button>
                <button onClick={() => handleDelete(book)} aria-label={`Delete ${book.bookTitle}`}>
                  <i className="bi bi-trash-fill" aria-hidden="true"></i>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
