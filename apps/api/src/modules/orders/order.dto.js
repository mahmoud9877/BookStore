import joi from "joi";
import { RequestDto, ResponseDto, fields, objectIdParamDto } from "../../core/dto.js";

// ---------- Requests

/** The order is built from the user's cart, so only delivery details are accepted. */
export class CreateOrderDto extends RequestDto {
  static schema = joi
    .object({
      address: joi.string().trim().required(),
      phone: joi
        .alternatives()
        .try(joi.string().trim(), joi.array().items(joi.string().trim()).min(1).max(3))
        .required(),
      note: joi.string().allow(""),
      paymentType: joi.string().valid("cash", "card").default("cash"),
    })
    .unknown(true);

  constructor(value) {
    super(value);
    this.phone = [].concat(this.phone); // stored as an array of numbers
  }
}

export class CancelOrderDto extends RequestDto {
  static schema = joi.object({
    orderId: fields.objectId(),
    reason: joi.string().min(2).max(5000).required(),
  });
}

export class OrderIdDto extends objectIdParamDto("orderId") {}

// ---------- Responses

export class OrderItemResponseDto extends ResponseDto {
  static fields = ["bookId", "bookTitle", "quantity", "unitPrice", "finalPrice"];
}

export class OrderResponseDto extends ResponseDto {
  static fields = [
    "_id",
    "userId",
    "address",
    "phone",
    "note",
    "books",
    "subtotal",
    "finalPrice",
    "paymentType",
    "status",
    "reason",
    "updatedBy",
    "createdAt",
    "updatedAt",
  ];
  static nested = { books: OrderItemResponseDto };
}

/** Only what a client needs to continue to the payment provider's checkout page. */
export class CheckoutSessionResponseDto extends ResponseDto {
  static fields = ["id", "url"];
}
