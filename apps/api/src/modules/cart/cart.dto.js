import joi from "joi";
import { RequestDto, ResponseDto, fields, objectIdParamDto } from "../../core/dto.js";

// ---------- Requests

export class AddToCartDto extends RequestDto {
  static schema = joi.object({
    bookId: fields.objectId(),
    quantity: joi.number().integer().min(1).required(),
  });
}

export class CartItemIdDto extends objectIdParamDto("bookId") {}

// ---------- Responses

export class CartItemResponseDto extends ResponseDto {
  static fields = ["bookId", "bookTitle", "image", "price", "quantity"];
}

export class CartResponseDto extends ResponseDto {
  static fields = ["_id", "userId", "books"];
  static nested = { books: CartItemResponseDto };
}
