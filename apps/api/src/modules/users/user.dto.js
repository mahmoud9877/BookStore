import { ResponseDto } from "../../core/dto.js";

/** Public view of a user account (never includes password or verification code). */
export class UserResponseDto extends ResponseDto {
  static fields = [
    "_id",
    "userName",
    "email",
    "role",
    "phone",
    "address",
    "image",
    "DOB",
    "confirmEmail",
    "createdAt",
    "updatedAt",
  ];
}
