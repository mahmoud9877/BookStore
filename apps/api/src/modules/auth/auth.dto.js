import joi from "joi";
import { RequestDto } from "../../core/dto.js";

// ---------- Requests (rules mirror apps/web/src/modules/auth/auth.validation.js)

export class RegisterUserDto extends RequestDto {
  static schema = joi
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

  // Checked, but never carried further.
  static validateOnly = ["cPassword"];
}

export class LoginDto extends RequestDto {
  static schema = joi
    .object({
      email: joi.string().email({ tlds: { allow: false } }).required(),
      password: joi.string().required(),
    })
    .unknown(true);
}

export class ConfirmationTokenDto extends RequestDto {
  static schema = joi.object({ token: joi.string().required() });
}
