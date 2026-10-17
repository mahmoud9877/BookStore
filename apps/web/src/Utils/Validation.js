import Joi from "joi";

// Joi schema for the signup form
const signupSchema = Joi.object({
  userName: Joi.string().min(3).max(30).required().label("User Name"),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .label("Email"),
  password: Joi.string().min(6).required().label("Password"),
  cPassword: Joi.any()
    .valid(Joi.ref("password"))
    .required()
    .label("Confirm Password")
    .messages({
      "any.only": "Passwords do not match.",
    }),
});

// Joi schema for the login form
const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .label("Email"),
  password: Joi.string().min(6).required().label("Password"),
});

export { signupSchema, loginSchema };
