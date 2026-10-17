import React from "react";

export default function BookList({ books, onEdit, onDelete }) {
  return (
    <div className="book-list">
      <h3>Book List</h3>
      <ul>
        {books.map((book) => (
          <li key={book._id}>
            <div>
              <strong>{book.bookTitle}</strong> by {book.author}
            </div>
            <div>
              <button type="button" onClick={() => onEdit(book)}>
                Edit
              </button>
              <button type="button" onClick={() => onDelete(book)} aria-label={`Delete ${book.bookTitle}`}>
                <i className="bi bi-trash-fill" aria-hidden="true"></i>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
