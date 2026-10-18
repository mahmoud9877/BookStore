import Joi from "joi";

// Rules kept in sync with the API's RegisterUserDto/LoginDto (apps/api/src/modules/auth/auth.dto.js);
// messages are written for people, not developers.
const email = Joi.string()
  .trim()
  .email({ tlds: { allow: false } })
  .required()
  .messages({
    "string.empty": "Enter your email address.",
    "string.email": "Enter a valid email address, like name@example.com.",
  });

export const signupSchema = Joi.object({
  userName: Joi.string().trim().min(3).max(30).required().messages({
    "string.empty": "Enter your name.",
    "string.min": "Your name needs at least 3 characters.",
    "string.max": "Your name can be at most 30 characters.",
  }),
  email,
  password: Joi.string().min(6).required().messages({
    "string.empty": "Choose a password.",
    "string.min": "Your password needs at least 6 characters.",
  }),
  cPassword: Joi.any().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords don't match.",
    "any.required": "Confirm your password.",
    "string.empty": "Confirm your password.",
  }),
});

export const loginSchema = Joi.object({
  email,
  password: Joi.string().required().messages({ "string.empty": "Enter your password." }),
});
