import React, { useState, useEffect } from "react";
import axios from "axios";
import { baseURL, bearerKey } from "../../index.js";
import "./style.css";

export default function BooksManager({ userData }) {
  // State for book details
  const [books, setBooks] = useState([]);
  const [bookForm, setBookForm] = useState({
    bookTitle: "",
    author: "",
    description: "",
    quantity: "",
    price: "",
    category: "",
    image: null, // For handling image uploads
  });
  const [selectedBook, setSelectedBook] = useState(null); // Book selected for update
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  console.log({ userData });

  // Fetch all books from the server
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const { data } = await axios.get(`${baseURL}/book`);
        setBooks(data.book || []);
      } catch (error) {
        console.error("Error fetching books:", error);
        setError("Failed to fetch books. Please try again later.");
      }
    };
    fetchBooks();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setBookForm((prevData) => ({
      ...prevData,
      [name]: files ? files[0] : value,
    }));
  };

  // Handle Add/Update book submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData();
    formData.append("bookTitle", bookForm.bookTitle);
    formData.append("author", bookForm.author);
    formData.append("description", bookForm.description);
    formData.append("quantity", bookForm.quantity);
    formData.append("price", bookForm.price);
    formData.append("category", bookForm.category);
    if (bookForm.image) formData.append("image", bookForm.image);

    try {
      if (selectedBook) {
        // Update book
        await axios.post(`${baseURL}/book/edit/${selectedBook._id}`, formData, {
          headers: {
            authorization: bearerKey + userData.token,
            "Content-Type": "multipart/form-data",
          },
        });
        alert("Book updated successfully");
      } else {
        // Add new book
        await axios.post(`${baseURL}/book/add`, formData, {
          headers: {
            authorization: bearerKey + userData.token,
            "Content-Type": "multipart/form-data",
          },
        });
        alert("Book added successfully");
      }

      // Refresh the book list
      const { data } = await axios.get(`${baseURL}/book`);
      setBooks(data.book || []);
      // Reset form after submission
      resetForm();
    } catch (error) {
      console.error("Error saving book:", error);
      setError("Failed to save book. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to reset form fields
  const resetForm = () => {
    setBookForm({
      bookTitle: "",
      author: "",
      description: "",
      quantity: "",
      price: "",
      category: "",
      image: null,
    });
    setSelectedBook(null); // Clear form after submission
  };

  // Handle Delete book
  async function handleDelete(bookId) {
    try {
      await axios.delete(`${baseURL}/book/delete/${bookId}`, {
        headers: {
          authorization: bearerKey + userData.token,
        },
      });
      alert("Book deleted successfully");
      // Refresh the book list after delete
      const { data } = await axios.get(`${baseURL}/book`);
      setBooks(data.book || []);
    } catch (error) {
      console.error("Failed to delete the book", error);
      setError("Failed to delete book. Please try again.");
    }
  }

  // Handle selecting a book for update
  const handleUpdateClick = (book) => {
    setSelectedBook(book);
    setBookForm({
      bookTitle: book.bookTitle,
      author: book.author,
      description: book.description,
      price: book.price,
      quantity: book.quantity,
      category: book.category,
      image: null, // No image initially
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
            <label className="form-label fw-bold">Name of the Book</label>
            <input
              type="text"
              className="form-control book-input shadow-sm rounded-3"
              name="bookTitle"
              value={bookForm.bookTitle}
              onChange={handleInputChange}
              placeholder="Enter the book title"
              required
            />
          </div>

          <div className="col-md-6 mb-4">
            <label className="form-label fw-bold">Author Name</label>
            <input
              type="text"
              className="form-control book-input shadow-sm rounded-3"
              name="author"
              value={bookForm.author}
              onChange={handleInputChange}
              placeholder="Enter the author's name"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label fw-bold">Category</label>
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
          <label className="form-label fw-bold">Description</label>
          <textarea
            className="form-control book-input shadow-sm rounded-3"
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
            <label className="form-label fw-bold">Quantity</label>
            <input
              type="number"
              className="form-control book-input shadow-sm rounded-3"
              name="quantity"
              value={bookForm.quantity}
              onChange={handleInputChange}
              placeholder="Enter the quantity"
              required
            />
          </div>

          <div className="col-md-6 mb-4">
            <label className="form-label fw-bold">Price $</label>
            <input
              type="number"
              className="form-control book-input shadow-sm rounded-3"
              name="price"
              value={bookForm.price}
              onChange={handleInputChange}
              placeholder="Enter the price"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label fw-bold">Book Image</label>
          <input
            type="file"
            className="form-control book-input bg-light shadow-sm rounded-3"
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
                <button onClick={() => handleUpdateClick(book)}>Edit</button>
                <button onClick={() => handleDelete(book._id)}>
                  <i class="bi bi-trash-fill"></i>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
