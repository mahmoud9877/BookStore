import React from "react";
import { Link } from "react-router-dom";

export default function CartItemCard({ item, onRemove }) {
  const title = item.bookTitle || "Unknown Title";
  return (
    <div className="col-lg-4 col-md-6 col-sm-12">
      <div className="card shadow-sm cart-card">
        <div className="card-body d-flex flex-column align-items-center">
          {item.image && <img src={item.image} alt={title} className="book-image mb-3" />}
          <h5 className="card-title text-center mb-2">{title}</h5>
          <p className="card-text text-center mb-2">
            <strong>Price: </strong>${item.price || "N/A"}
          </p>
          <p className="card-text text-center mb-3">
            <strong>Quantity: </strong>
            {item.quantity}
          </p>
          <div className="cart-buttons w-100">
            <Link to={`/book/${item.bookId}`} className="btn btn-primary w-100 mb-2">
              View Book
            </Link>
            <button className="btn btn-danger w-100" onClick={() => onRemove(item.bookId)}>
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
