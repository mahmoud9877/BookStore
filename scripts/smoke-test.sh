#!/usr/bin/env bash
# End-to-end smoke test of the main bookstore workflows against a running stack
# with a real MongoDB. Intended for the development Compose stack:
#
#   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
#   ./scripts/smoke-test.sh
#
# It creates a throwaway user, promotes it to Admin and seeds one category and one
# book directly in MongoDB (book creation through the API requires Cloudinary).
# Needs REQUIRE_EMAIL_CONFIRMATION=false (the development default). Never run it
# against a production database.
set -euo pipefail

API_URL="${API_URL:-http://localhost:${DEV_API_PORT:-4000}}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.dev.yml)
BEARER_KEY="${BEARER_KEY:-$(grep -E '^BEARER_KEY=' .env | cut -d= -f2-)}"
RUN_ID="$(date +%s)$RANDOM"
EMAIL="smoke-${RUN_ID}@example.com"
PASSWORD="smoke-pass-1"

pass=0
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { pass=$((pass + 1)); echo "ok - $*"; }

# request METHOD PATH [JSON_BODY] [TOKEN] -> sets $STATUS and $BODY
request() {
  local args=(-s -o "$BODY_FILE" -w '%{http_code}' -X "$1" "$API_URL$2")
  [[ -n "${3:-}" ]] && args+=(-H 'content-type: application/json' -d "$3")
  [[ -n "${4:-}" ]] && args+=(-H "authorization: ${BEARER_KEY}$4")
  STATUS="$(curl "${args[@]}")"
  BODY="$(cat "$BODY_FILE")"
}
json() { node -e "const d=JSON.parse(process.argv[1]); const v=($2); console.log(typeof v==='object'?JSON.stringify(v):v)" "$BODY"; }
expect_status() { [[ "$STATUS" == "$1" ]] || fail "$2: expected HTTP $1, got $STATUS: $BODY"; ok "$2"; }
mongo() { "${COMPOSE[@]}" exec -T mongo mongosh bookstore --quiet --eval "$1"; }

request GET /health
expect_status 200 "API is healthy and connected to MongoDB"

request POST /auth/signup "{\"userName\":\"smoke\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"cPassword\":\"$PASSWORD\"}"
expect_status 201 "signup"

request POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"wrong-pass\"}"
expect_status 401 "login with a wrong password is rejected"

request POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
expect_status 200 "login"
USER_TOKEN="$(json "$BODY" d.token)"

request POST /category '{"name":"fiction"}' "$USER_TOKEN"
expect_status 403 "regular users cannot create categories"

mongo "db.users.updateOne({email:'$EMAIL'},{\$set:{role:'Admin'}})" >/dev/null
CATEGORY="smoke-${RUN_ID}"
request POST /category "{\"name\":\"$CATEGORY\"}" "$USER_TOKEN"
expect_status 201 "admins can create categories"
CATEGORY_ID="$(json "$BODY" d.category._id)"

request GET "/category/$CATEGORY_ID"
expect_status 200 "get a category by id"

request PUT "/category/$CATEGORY_ID" '{"name":"poetry"}' "$USER_TOKEN"
expect_status 400 "category names outside the predefined options are rejected"

BOOK_ID="$(mongo "print(db.books.insertOne({bookTitle:'smoke book',author:'tester',description:'d',image:'https://example.com/x.png',price:25,quantity:5,category:'$CATEGORY',totalLikes:0,likes:[],createdAt:new Date(),updatedAt:new Date()}).insertedId.toString())" | tail -1)"

request GET /book
expect_status 200 "list books"
[[ "$(json "$BODY" "d.book.some(b=>b._id==='$BOOK_ID')")" == "true" ]] || fail "seeded book missing from list"

request GET "/book/$BOOK_ID"
expect_status 200 "book details"

request GET /cart "" "$USER_TOKEN"
expect_status 404 "a new user has no cart yet"

request POST /cart/add "{\"bookId\":\"$BOOK_ID\",\"quantity\":10}" "$USER_TOKEN"
expect_status 400 "cannot add more copies than are in stock"

request POST /cart/add "{\"bookId\":\"$BOOK_ID\",\"quantity\":2}" "$USER_TOKEN"
expect_status 201 "add to cart"

request POST /order '{"address":"1 Nile St","phone":"01012345678","paymentType":"cash"}' "$USER_TOKEN"
expect_status 201 "place a cash order"
ORDER_ID="$(json "$BODY" d.order._id)"
[[ "$(json "$BODY" d.order.finalPrice)" == "50" ]] || fail "order total should be 50"

request GET "/book/$BOOK_ID"
[[ "$(json "$BODY" d.book.quantity)" == "3" ]] || fail "stock should drop from 5 to 3, got: $BODY"
ok "placing an order decrements stock"

request GET /cart "" "$USER_TOKEN"
[[ "$(json "$BODY" d.cart.books.length)" == "0" ]] || fail "cart should be empty after ordering"
ok "cart is emptied after ordering"

request PATCH "/order/$ORDER_ID/delivered" "" "$USER_TOKEN"
expect_status 200 "admin marks the order delivered"
[[ "$(mongo "print(db.orders.findOne({_id:ObjectId('$ORDER_ID')}).status)" | tail -1)" == "delivered" ]] \
  || fail "order status should be 'delivered'"
ok "order status persisted as delivered"

request POST /cart/add "{\"bookId\":\"$BOOK_ID\",\"quantity\":1}" "$USER_TOKEN"
request POST /order '{"address":"1 Nile St","phone":["01012345678"]}' "$USER_TOKEN"
expect_status 201 "place a second order"
SECOND_ORDER_ID="$(json "$BODY" d.order._id)"
request PATCH "/order/$SECOND_ORDER_ID/cancel" '{"reason":"changed my mind"}' "$USER_TOKEN"
expect_status 200 "cancel an order"
request GET "/book/$BOOK_ID"
[[ "$(json "$BODY" d.book.quantity)" == "3" ]] || fail "cancel should restore stock to 3, got: $BODY"
ok "cancelling restores stock"

request PATCH "/book/$BOOK_ID/like" "" "$USER_TOKEN"
expect_status 200 "like a book"
request PATCH "/book/$BOOK_ID/like" "" "$USER_TOKEN"
expect_status 400 "cannot like the same book twice"
request PATCH "/book/$BOOK_ID/unlike" "" "$USER_TOKEN"
expect_status 200 "unlike a book"
[[ "$(json "$BODY" d.book.totalLikes)" == "0" ]] || fail "totalLikes should return to 0"

request POST /cart/add "{\"bookId\":\"$BOOK_ID\",\"quantity\":1}" "$USER_TOKEN"
request DELETE /cart/clear "" "$USER_TOKEN"
expect_status 200 "clear cart"

request GET /auth/user "" "$USER_TOKEN"
expect_status 200 "admin lists users"
[[ "$(json "$BODY" "d.users.some(u=>'password' in u)")" == "false" ]] || fail "password hashes leaked"
ok "user list excludes password hashes"

request GET /category/options
expect_status 200 "category options route is reachable"

request POST /category "{\"name\":\"${CATEGORY}-tmp\"}" "$USER_TOKEN"
TMP_CATEGORY_ID="$(json "$BODY" d.category._id)"
request DELETE "/category/$TMP_CATEGORY_ID" "" "$USER_TOKEN"
expect_status 200 "admins can delete categories"
request GET "/category/$TMP_CATEGORY_ID"
expect_status 404 "deleted categories are gone"

request GET /no-such-route
expect_status 404 "unknown routes return 404"

# Clean up everything this run created.
mongo "const user = db.users.findOne({email:'$EMAIL'});
  db.orders.deleteMany({userId:user._id});
  db.carts.deleteMany({userId:user._id});
  db.books.deleteOne({_id:ObjectId('$BOOK_ID')});
  db.categories.deleteOne({name:'$CATEGORY'});
  db.users.deleteOne({_id:user._id});" >/dev/null

echo "All $pass smoke checks passed."
