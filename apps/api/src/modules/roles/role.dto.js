import joi from "joi";
import { ALL_PERMISSIONS, BRANCH_SCOPES } from "./permissions.js";
import { RequestDto, ResponseDto, fields, objectIdParamDto } from "../../core/dto.js";

// ---------- Requests

const description = joi.string().trim().allow("").max(200).default("");
const permissions = joi
  .array()
  .items(joi.string().valid(...ALL_PERMISSIONS))
  .unique()
  .default([]);
const branchScope = joi
  .string()
  .valid(...Object.values(BRANCH_SCOPES))
  .default(BRANCH_SCOPES.assigned);

export class RoleIdDto extends objectIdParamDto("id") {}

export class CreateRoleDto extends RequestDto {
  static schema = joi.object({
    name: joi.string().trim().min(2).max(40).required(),
    description,
    permissions,
    branchScope,
  });
}

/** The name is fixed once created (users reference roles by name). */
export class UpdateRoleDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), description, permissions, branchScope });
}

// ---------- Responses

export class RoleResponseDto extends ResponseDto {
  static fields = ["_id", "name", "description", "permissions", "branchScope", "isSystem", "userCount"];
}
