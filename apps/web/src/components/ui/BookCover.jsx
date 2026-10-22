import React, { useState } from "react";
import { coverUrl } from "../../lib/cover-url.js";

/** Cover image (local "/uploads/…" paths resolved against the API) with a placeholder when missing or broken. */
export default function BookCover({ src, alt, className = "book-cover" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className} book-cover-placeholder`} role="img" aria-label={alt}>
        <i className="bi bi-book" aria-hidden="true"></i>
      </div>
    );
  }
  return <img src={coverUrl(src)} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
