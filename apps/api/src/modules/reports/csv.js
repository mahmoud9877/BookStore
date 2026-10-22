/** RFC 4180 CSV. Cells starting with =, +, - or @ are prefixed so spreadsheets never run them as formulas. */
const cell = (value) => {
  if (value == null) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** `columns`: [{ key, label }] or [key]; `key` may be a function of the row. */
export function toCsv(rows, columns) {
  const normalized = columns.map((column) => (typeof column === "string" ? { key: column, label: column } : column));
  const header = normalized.map((column) => cell(column.label)).join(",");
  const lines = rows.map((row) =>
    normalized.map(({ key }) => cell(typeof key === "function" ? key(row) : row[key])).join(",")
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}
