import joi from "joi";
import { RequestDto, ResponseDto } from "../../core/dto.js";

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

  // cPassword is only checked, never carried further.
  constructor({ userName, email, password, phone }) {
    super();
    this.userName = userName;
    this.email = email;
    this.password = password;
    this.phone = phone;
  }
}

export class LoginDto extends RequestDto {
  static schema = joi
    .object({
      email: joi.string().email({ tlds: { allow: false } }).required(),
      password: joi.string().required(),
    })
    .unknown(true);

  constructor({ email, password }) {
    super();
    this.email = email;
    this.password = password;
  }
}

export class ConfirmationTokenDto extends RequestDto {
  static schema = joi.object({ token: joi.string().required() });

  constructor({ token }) {
    super();
    this.token = token;
  }
}

// ---------- Responses

/** Public view of a user account (never includes password or verification code). */
export class UserResponseDto extends ResponseDto {
  constructor(user) {
    super();
    this._id = user._id;
    this.userName = user.userName;
    this.email = user.email;
    this.role = user.role;
    this.phone = user.phone;
    this.address = user.address;
    this.image = user.image;
    this.DOB = user.DOB;
    this.confirmEmail = user.confirmEmail;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}
