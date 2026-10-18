import React, { useState } from "react";

/** Cover image that falls back to a neutral placeholder when missing or broken. */
export default function BookCover({ src, alt, className = "book-cover" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className} book-cover-placeholder`} role="img" aria-label={alt}>
        <i className="bi bi-book" aria-hidden="true"></i>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
