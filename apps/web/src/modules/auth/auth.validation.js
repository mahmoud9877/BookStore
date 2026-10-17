import Joi from "joi";

// Kept in sync with apps/api/src/modules/auth/auth.validation.js.
const email = Joi.string()
  .email({ tlds: { allow: false } })
  .required()
  .label("Email");

export const signupSchema = Joi.object({
  userName: Joi.string().trim().min(3).max(30).required().label("User Name"),
  email,
  password: Joi.string().min(6).required().label("Password"),
  cPassword: Joi.any()
    .valid(Joi.ref("password"))
    .required()
    .label("Confirm Password")
    .messages({
      "any.only": "Passwords do not match.",
    }),
});

export const loginSchema = Joi.object({
  email,
  password: Joi.string().min(6).required().label("Password"),
});
