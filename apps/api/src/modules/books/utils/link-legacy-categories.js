/**
 * Books used to store their category's name; they now reference the category's
 * id. Converts any remaining name-based books (creating a missing category so no
 * book is orphaned). Idempotent and cheap once done, so it runs on every start.
 */
export async function linkLegacyBookCategories({ bookRepository, categoryRepository }) {
  const legacyBooks = await bookRepository.findWithLegacyCategory();
  if (!legacyBooks.length) return 0;

  const idsByName = new Map();
  const categoryIdFor = async (rawName) => {
    const name = rawName.trim().toLowerCase();
    if (!idsByName.has(name)) {
      const category = (await categoryRepository.findByName(name)) ?? (await categoryRepository.create({ name }));
      idsByName.set(name, category._id);
    }
    return idsByName.get(name);
  };

  const links = [];
  for (const book of legacyBooks) {
    links.push({ bookId: book._id, categoryId: await categoryIdFor(book.category) });
  }
  await bookRepository.setCategories(links);
  return links.length;
}
