import React from "react";
import { Link } from "react-router-dom";
import BookCover from "../../components/ui/BookCover.jsx";
import Price from "../books/Price.jsx";
import { formatPrice, formatTitle } from "../../lib/format.js";
import { t } from "../../i18n/index.js";

export default function CartLineItem({ item, onRemove, isRemoving }) {
  const title = item.bookTitle ? formatTitle(item.bookTitle) : t("Untitled");
  return (
    <li className="line-item">
      <BookCover src={item.image} alt="" className="" />
      <div className="min-w-0">
        <Link to={`/book/${item.bookId}`} className="fw-semibold text-body d-block text-truncate">
          {title}
        </Link>
        <div className="small text-muted">
          <Price amount={item.price} original={item.originalPrice} /> × {item.quantity}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost-danger px-0 mt-1"
          onClick={() => onRemove(item)}
          disabled={isRemoving}
          aria-label={t("Remove {title} from cart", { title })}
        >
          <i className="bi bi-trash3 me-1" aria-hidden="true"></i>{t("Remove")}
        </button>
      </div>
      <div className="price text-end">{formatPrice(item.price * item.quantity)}</div>
    </li>
  );
}
