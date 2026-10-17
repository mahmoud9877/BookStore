import axios from "axios";
import { useEffect, useState } from "react";
import { baseURL, bearerKey } from "../index.js";

function useRoute() {
  const [books, setBooks] = useState([]);

  // Fetch books from the API
  async function getBooks() {
    try {
      const { data } = await axios.get(`${baseURL}/book`);
      const { book } = data;
      setBooks(book); // Set the books state
    } catch (error) {
      console.error("Error fetching books:", error);
    }
  }

  useEffect(() => {
    getBooks();
  }, []);

  // Handle adding a book to the cart
  const handleAddToCart = async (bookId) => {
    const token = localStorage.getItem("userToken"); // Get the token from localStorage
    if (!token) {
      alert("Please log in to add books to your cart.");
      console.log("No token found in localStorage.");
      return;
    }

    try {
      await axios.post(
        `${baseURL}/cart/add`, // Corrected endpoint
        { bookId, quantity: 1 }, // Include both bookId and quantity in the request body
        {
          headers: {
            Authorization: `${bearerKey}${token}`, // Corrected the capitalization and token usage
          },
        }
      );
      console.log("Book added to cart:", bookId);
      alert("Book added to cart!");
    } catch (error) {
      console.error("Error adding book to cart:", error);
      alert("Failed to add book to cart. Please try again.");
    }
  };

  return { books, getBooks, handleAddToCart };
}

export default useRoute;
