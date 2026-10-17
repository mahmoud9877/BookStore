import joi from "joi";
import { generalFields } from "../../middleware/validate.js";

// The order is built from the user's cart, so only delivery details are accepted.
export const createOrder = joi
  .object({
    address: joi.string().trim().required(),
    phone: joi
      .alternatives()
      .try(joi.string().trim(), joi.array().items(joi.string().trim()).min(1).max(3))
      .required(),
    note: joi.string().allow(""),
    paymentType: joi.string().valid("cash", "card"),
  })
  .unknown(true);

export const cancelOrder = joi.object({
  orderId: generalFields.id,
  reason: joi.string().min(2).max(5000).required(),
});

export const deliverOrder = joi.object({
  orderId: generalFields.id,
});
