import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";

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

  constructor({ address, phone, note, paymentType }) {
    super();
    this.address = address;
    this.phone = [].concat(phone); // stored as an array of numbers
    this.note = note;
    this.paymentType = paymentType;
  }
}

export class CancelOrderDto extends RequestDto {
  static schema = joi.object({
    orderId: fields.objectId(),
    reason: joi.string().min(2).max(5000).required(),
  });

  constructor({ orderId, reason }) {
    super();
    this.orderId = orderId;
    this.reason = reason;
  }
}

export class OrderIdDto extends RequestDto {
  static schema = joi.object({ orderId: fields.objectId() });

  constructor({ orderId }) {
    super();
    this.orderId = orderId;
  }
}

// ---------- Responses

export class OrderItemResponseDto extends ResponseDto {
  constructor(item) {
    super();
    this.bookId = item.bookId;
    this.bookTitle = item.bookTitle;
    this.quantity = item.quantity;
    this.unitPrice = item.unitPrice;
    this.finalPrice = item.finalPrice;
  }
}

export class OrderResponseDto extends ResponseDto {
  constructor(order) {
    super();
    this._id = order._id;
    this.userId = order.userId;
    this.address = order.address;
    this.phone = order.phone;
    this.note = order.note;
    this.books = OrderItemResponseDto.fromList(order.books);
    this.subtotal = order.subtotal;
    this.finalPrice = order.finalPrice;
    this.paymentType = order.paymentType;
    this.status = order.status;
    this.reason = order.reason;
    this.updatedBy = order.updatedBy;
    this.createdAt = order.createdAt;
    this.updatedAt = order.updatedAt;
  }
}

/** Only what a client needs to continue to Stripe Checkout. */
export class CheckoutSessionResponseDto extends ResponseDto {
  constructor(session) {
    super();
    this.id = session.id;
    this.url = session.url;
  }
}
