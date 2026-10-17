// Request DTOs: validation, type conversion and field whitelisting.
// Response DTOs: exactly which fields leave the API.
import { Types } from "mongoose";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RegisterUserDto } from "../src/modules/auth/auth.dto.js";
import { UserResponseDto } from "../src/modules/users/user.dto.js";
import { AddToCartDto, CartResponseDto } from "../src/modules/cart/cart.dto.js";
import {
  BookResponseDto,
  CreateBookDto,
  ListBooksQueryDto,
  UpdateBookDto,
} from "../src/modules/books/book.dto.js";
import {
  CheckoutSessionResponseDto,
  CreateOrderDto,
  OrderResponseDto,
} from "../src/modules/orders/order.dto.js";

const id = () => new Types.ObjectId().toString();

describe("request DTOs", () => {
  test("drop fields the client is not allowed to set", () => {
    const { dto } = CreateBookDto.parse({
      bookTitle: " Dune ",
      author: "Frank Herbert",
      description: "d",
      price: "12.5",
      category: "fiction",
      quantity: "3",
      totalLikes: 1000,
      image: "https://attacker.example/x.png",
    });
    assert.ok(dto instanceof CreateBookDto);
    assert.deepEqual(dto.toAttributes(), {
      bookTitle: "Dune",
      author: "Frank Herbert",
      description: "d",
      price: 12.5,
      category: "fiction",
      quantity: 3,
    });
    assert.equal("totalLikes" in dto, false);
    assert.equal("image" in dto, false);
  });

  test("convert multipart/query strings to numbers", () => {
    const { dto } = AddToCartDto.parse({ bookId: id(), quantity: "2" });
    assert.strictEqual(dto.quantity, 2);
  });

  test("report every validation problem at once", () => {
    const { dto, error } = UpdateBookDto.parse({ id: "not-an-id", price: -1 });
    assert.equal(dto, undefined);
    const paths = error.details.map((detail) => detail.path[0]);
    for (const field of ["id", "price", "bookTitle", "quantity"]) assert.ok(paths.includes(field), field);
  });

  test("password confirmation is checked but never carried into the DTO", () => {
    const input = { userName: "reader", email: "a@b.com", password: "secret1" };
    assert.ok(RegisterUserDto.parse({ ...input, cPassword: "other" }).error);
    const { dto } = RegisterUserDto.parse({ ...input, cPassword: "secret1" });
    assert.equal("cPassword" in dto, false);
  });

  test("orders default to cash and always carry phone numbers as a list", () => {
    const { dto } = CreateOrderDto.parse({ address: "1 Nile St", phone: "01012345678", couponName: "x" });
    assert.equal(dto.paymentType, "cash");
    assert.deepEqual(dto.phone, ["01012345678"]);
    assert.equal("couponName" in dto, false);
  });

  test("pagination is lenient: invalid values disable it instead of failing", () => {
    const paged = ListBooksQueryDto.parse({ page: "3", limit: "10" }).dto;
    assert.deepEqual([paged.isPaginated, paged.skip, paged.limit], [true, 20, 10]);
    for (const query of [{}, { limit: "abc" }, { limit: "0" }, { limit: "10abc" }]) {
      assert.equal(ListBooksQueryDto.parse(query).dto.isPaginated, false, JSON.stringify(query));
    }
  });
});

describe("response DTOs", () => {
  test("books hide the list of users who liked them and Mongoose internals", () => {
    const book = {
      _id: id(),
      bookTitle: "dune",
      author: "frank herbert",
      description: "d",
      image: "https://img/x.png",
      price: 10,
      quantity: 2,
      category: "fiction",
      totalLikes: 1,
      likes: [id()],
      __v: 0,
    };
    const json = JSON.parse(JSON.stringify(BookResponseDto.from(book)));
    assert.equal("likes" in json, false);
    assert.equal("__v" in json, false);
    for (const field of ["_id", "bookTitle", "author", "image", "price", "quantity", "category"]) {
      assert.ok(field in json, field);
    }
  });

  test("users never expose password hashes or verification codes", () => {
    const json = JSON.parse(
      JSON.stringify(UserResponseDto.from({ _id: id(), email: "a@b.com", password: "$2a$hash", code: 1234 }))
    );
    assert.equal("password" in json, false);
    assert.equal("code" in json, false);
    assert.equal(json.email, "a@b.com");
  });

  test("carts and orders map their line items", () => {
    const bookId = id();
    const cart = CartResponseDto.from({
      _id: id(),
      userId: id(),
      books: [{ _id: id(), bookId, bookTitle: "dune", image: "i", price: 5, quantity: 2 }],
    });
    assert.deepEqual(Object.keys(cart.books[0]), ["bookId", "bookTitle", "image", "price", "quantity"]);

    const order = OrderResponseDto.from({ _id: id(), status: "placed", books: [{ bookId, quantity: 1, unitPrice: 5, finalPrice: 5 }] });
    assert.equal(order.books[0].finalPrice, 5);
  });

  test("checkout sessions expose only the id and redirect url", () => {
    const session = CheckoutSessionResponseDto.from({ id: "cs_1", url: "https://pay", client_secret: "secret", customer_email: "a@b.com" });
    assert.deepEqual({ ...session }, { id: "cs_1", url: "https://pay" });
    assert.equal(CheckoutSessionResponseDto.from(undefined), null);
  });
});
