import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";
import { MAX_PAGE_SIZE } from "../../core/pagination.js";

// ---------- Requests

export class ListUsersDto extends RequestDto {
  static schema = joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(50),
    search: joi.string().trim().max(100).allow(""),
    role: joi.string().trim(),
  });
}

export class ChangeUserRoleDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), role: joi.string().trim().required() });
}

export class UpdateUserAccessDto extends RequestDto {
  static schema = joi.object({
    id: fields.objectId(),
    branches: joi.array().items(fields.objectId()).unique(),
    isActive: joi.boolean(),
  }).or("branches", "isActive");
}

// ---------- Responses

/** Public view of a user account (never includes password or verification code). */
export class UserResponseDto extends ResponseDto {
  static fields = [
    "_id",
    "userName",
    "email",
    "role",
    "branches",
    "isActive",
    "phone",
    "address",
    "image",
    "DOB",
    "confirmEmail",
    "createdAt",
    "updatedAt",
  ];
}

/** The signed-in user plus what their role allows. */
export class CurrentUserResponseDto extends UserResponseDto {
  static fields = [...UserResponseDto.fields, "permissions", "branchScope", "memberId"];
}
