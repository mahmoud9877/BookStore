import Joi from "joi";

export const PAYMENT_METHODS = [
  { value: "card", label: "Card", description: "Pay securely online with Stripe." },
  { value: "cash", label: "Cash on delivery", description: "Pay when your books arrive." },
];

export const checkoutSchema = Joi.object({
  address: Joi.string().trim().min(5).required().label("Delivery address").messages({
    "string.empty": "Enter a delivery address.",
    "string.min": "Enter your full delivery address.",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9 ()-]{7,20}$/)
    .required()
    .label("Phone")
    .messages({
      "string.empty": "Enter a phone number so the courier can reach you.",
      "string.pattern.base": "Enter a valid phone number.",
    }),
  note: Joi.string().allow("").max(500).label("Note"),
  paymentType: Joi.string().valid("card", "cash").required(),
});
