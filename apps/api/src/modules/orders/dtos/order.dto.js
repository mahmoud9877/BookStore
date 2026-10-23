import joi from "joi";
import { RequestDto, ResponseDto, fields, objectIdParamDto } from "../../../core/dto.js";

// ---------- Requests

/** The order is built from the user's cart, so only delivery details are accepted. */
export class CreateOrderDto extends RequestDto {
  static schema = joi
    .object({
      address: joi.string().trim().required(),
      phone: joi
        .alternatives()
        .try(fields.mobile(), joi.array().items(fields.mobile()).min(1).max(3))
        .required(),
      note: joi.string().allow(""),
      paymentType: joi.string().valid("cash", "card").default("cash"),
      // Optional coupon; "" means none.
      couponCode: joi.string().trim().max(60).allow(""),
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
    "discount",
    "coupon",
    "finalPrice",
    "paymentType",
    "status",
    "reason",
    "updatedBy",
    "createdAt",
    "updatedAt",
  ];
  static nested = { books: OrderItemResponseDto };

  constructor(source) {
    super(source);
    // Orders placed before coupons existed have neither field.
    this.discount = source.discount ?? 0;
    this.coupon = source.coupon?.code ? { code: source.coupon.code, discount: source.coupon.discount } : null;
  }
}

/** Only what a client needs to continue to the payment provider's checkout page. */
export class CheckoutSessionResponseDto extends ResponseDto {
  static fields = ["id", "url"];
}
