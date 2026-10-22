#!/usr/bin/env bash
# Seeds the DEVELOPMENT database with categories, a catalogue of books, two
# accounts and library data (branches, copies, members, loans, a reservation,
# fines, rooms, an event), so the web app can be explored with realistic data:
#
#   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
#   ./scripts/seed-dev-data.sh
#
#   admin@bookstore.local / admin123   (role Admin -> /dashboard)
#   reader@bookstore.local / reader123 (role User)
#
# Books are inserted directly (adding books through the API needs Cloudinary).
# Safe to re-run: existing categories, books and accounts are left untouched.
# Never run it against a production database.
set -euo pipefail

API_URL="${API_URL:-http://localhost:${DEV_API_PORT:-4000}}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.dev.yml)
mongo() { "${COMPOSE[@]}" exec -T mongo mongosh bookstore --quiet --eval "$1"; }

signup() {
  curl -s -o /dev/null -X POST "$API_URL/auth/signup" -H 'content-type: application/json' \
    -d "{\"userName\":\"$1\",\"email\":\"$2\",\"password\":\"$3\",\"cPassword\":\"$3\"}"
}

if ! curl -sf "$API_URL/health" >/dev/null; then
  echo "API is not reachable at $API_URL." >&2
  [[ -f .env ]] || echo "No .env file found — create one first: cp .env.example .env" >&2
  echo "Check why it isn't healthy with: docker compose -f docker-compose.yml -f docker-compose.dev.yml logs api" >&2
  exit 1
fi

signup "Store Admin" admin@bookstore.local admin123
signup "Reader" reader@bookstore.local reader123

mongo '
db.users.updateMany(
  { email: { $in: ["admin@bookstore.local", "reader@bookstore.local"] } },
  { $set: { confirmEmail: true } }
);
db.users.updateOne({ email: "admin@bookstore.local" }, { $set: { role: "Admin" } });

for (const name of ["fiction", "non-fiction", "science", "biography", "fantasy"]) {
  db.categories.updateOne(
    { name },
    { $setOnInsert: { name, createdAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  );
}

const cover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
const books = [
  ["dune", "frank herbert", "fantasy", 320, 12, "9780441172719",
   "On the desert planet Arrakis, young Paul Atreides is drawn into a struggle for the most valuable substance in the universe."],
  ["the hobbit", "j. r. r. tolkien", "fantasy", 250, 8, "9780547928227",
   "Bilbo Baggins is swept into a quest to reclaim a lost dwarf kingdom from the dragon Smaug."],
  ["sapiens", "yuval noah harari", "non-fiction", 410, 15, "9780062316097",
   "A brief history of humankind, from the Stone Age to the twenty-first century."],
  ["a brief history of time", "stephen hawking", "science", 280, 6, "9780553380163",
   "A landmark exploration of black holes, the Big Bang and the nature of time."],
  ["steve jobs", "walter isaacson", "biography", 450, 4, "9781451648539",
   "The exclusive biography of the co-founder of Apple, based on more than forty interviews."],
  ["1984", "george orwell", "fiction", 190, 20, "9780451524935",
   "A chilling portrait of a totalitarian future where Big Brother is always watching."],
  ["to kill a mockingbird", "harper lee", "fiction", 210, 9, "9780061120084",
   "A young girl comes of age in a Southern town shaken by a racially charged trial."],
  ["the selfish gene", "richard dawkins", "science", 300, 3, "9780198788607",
   "A classic account of evolution told from the point of view of the gene."],
  ["educated", "tara westover", "biography", 330, 7, "9780399590504",
   "A memoir of a young woman who leaves her survivalist family and goes on to earn a PhD."],
];
for (const [bookTitle, author, categoryName, price, quantity, isbn, description] of books) {
  // A book references its category by id (one category has many books).
  const category = db.categories.findOne({ name: categoryName })._id;
  db.books.updateOne(
    { bookTitle },
    { $setOnInsert: { bookTitle, author, category, price, quantity, description,
        image: cover(isbn), likes: [], totalLikes: 0, createdAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  );
}
print(`books: ${db.books.countDocuments()}, categories: ${db.categories.countDocuments()}`);
'
# Library data (copies, members, loans, …) goes through the API's own services.
"${COMPOSE[@]}" exec -T api npm run --silent seed:demo
echo "Seeded. Log in as admin@bookstore.local / admin123 or reader@bookstore.local / reader123 (a library member)."
