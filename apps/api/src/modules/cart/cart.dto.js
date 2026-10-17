import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";

// ---------- Requests

export class AddToCartDto extends RequestDto {
  static schema = joi.object({
    bookId: fields.objectId(),
    quantity: joi.number().integer().min(1).required(),
  });

  constructor({ bookId, quantity }) {
    super();
    this.bookId = bookId;
    this.quantity = quantity;
  }
}

export class CartItemIdDto extends RequestDto {
  static schema = joi.object({ bookId: fields.objectId() });

  constructor({ bookId }) {
    super();
    this.bookId = bookId;
  }
}

// ---------- Responses

export class CartItemResponseDto extends ResponseDto {
  constructor(item) {
    super();
    this.bookId = item.bookId;
    this.bookTitle = item.bookTitle;
    this.image = item.image;
    this.price = item.price;
    this.quantity = item.quantity;
  }
}

export class CartResponseDto extends ResponseDto {
  constructor(cart) {
    super();
    this._id = cart._id;
    this.userId = cart.userId;
    this.books = CartItemResponseDto.fromList(cart.books);
  }
}
