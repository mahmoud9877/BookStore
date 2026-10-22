import joi from "joi";

export const MAX_PAGE_SIZE = 100;

/**
 * Joi keys for `?page=&limit=&sort=` on collection endpoints. `sort` is a field
 * name, prefixed with "-" for descending, restricted to `sortable` fields.
 */
export const paginationKeys = (sortable = [], defaultSort = "-createdAt") => ({
  page: joi.number().integer().min(1).default(1),
  limit: joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(20),
  sort: joi
    .string()
    .valid(...sortable.flatMap((field) => [field, `-${field}`]))
    .default(defaultSort),
});

/** "-createdAt" -> { createdAt: -1, _id: -1 } (the _id tiebreaker keeps pages stable). */
export function toSort(sort) {
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;
  return { [field]: descending ? -1 : 1, _id: descending ? -1 : 1 };
}

/** The response envelope for collection endpoints. */
export const pageOf = ({ items, total }, { page, limit }) => ({
  data: items,
  meta: { page, limit, total, pages: Math.ceil(total / limit) },
});

/** Escapes user input for use inside a RegExp. */
export const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
