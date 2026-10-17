import joi from "joi";

// Mirrors the web client's rules (apps/web/src/modules/auth/auth.validation.js).
export const signup = joi
  .object({
    userName: joi.string().trim().min(3).max(30).required(),
    email: joi.string().email({ tlds: { allow: false } }).required(),
    password: joi.string().min(6).required(),
    cPassword: joi.valid(joi.ref("password")).messages({
      "any.only": "Passwords do not match.",
    }),
    phone: joi.string().trim(),
  })
  .unknown(true);

export const login = joi
  .object({
    email: joi.string().email({ tlds: { allow: false } }).required(),
    password: joi.string().required(),
  })
  .unknown(true);

export const confirmationToken = joi.object({
  token: joi.string().required(),
});
