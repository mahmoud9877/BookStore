import React from "react";

/** Placeholder lines shown while content loads (decorative; the container announces busy state). */
export function SkeletonRows({ rows = 5, columns = 4 }) {
  return (
    <div className="p-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div className="skeleton-row" key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <span className="skeleton skeleton-line" key={column} style={{ width: `${column === 0 ? 34 : 18 + ((row + column) % 3) * 6}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default SkeletonRows;
