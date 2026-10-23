import Joi from "joi";
import { msg } from "../../i18n/index.js";
import { isValidMobile } from "../../lib/phone.js";

export const PAYMENT_METHODS = [
  { value: "card", label: msg("Card"), description: msg("Pay securely online with Stripe.") },
  { value: "cash", label: msg("Cash on delivery"), description: msg("Pay when your books arrive.") },
];

export const checkoutSchema = Joi.object({
  address: Joi.string().trim().min(5).required().label("Delivery address").messages({
    "string.empty": "Enter a delivery address.",
    "string.min": "Enter your full delivery address.",
  }),
  phone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => (isValidMobile(value) ? value : helpers.error("phone.invalid")))
    .label("Mobile number")
    .messages({
      "string.empty": "Enter a mobile number so the courier can reach you.",
      "phone.invalid": "Enter a valid mobile number.",
    }),
  note: Joi.string().allow("").max(500).label("Note"),
  paymentType: Joi.string().valid("card", "cash").required(),
});
