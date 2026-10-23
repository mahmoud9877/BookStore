import joi from "joi";
import { MEMBER_KINDS, MEMBER_STATUSES } from "./member.model.js";
import { paginationKeys } from "../../core/pagination.js";
import { RequestDto, ResponseDto, crudDtos, fields } from "../../core/dto.js";

const contact = {
  name: joi.string().trim().max(150),
  kind: joi.string().valid(...MEMBER_KINDS),
  email: joi.string().email({ tlds: { allow: false } }).allow(""),
  phone: fields.mobile().allow(""),
  address: joi.string().trim().max(300).allow(""),
  institution: joi.string().trim().max(150).allow(""),
  notes: joi.string().trim().max(1000).allow(""),
};

export class MemberIdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}

export class ListMembersDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["name", "memberNumber", "expiresAt", "createdAt"], "name"),
    search: joi.string().trim().max(100).allow(""),
    status: joi.string().valid(...Object.values(MEMBER_STATUSES)),
    kind: joi.string().valid(...MEMBER_KINDS),
    membershipType: fields.ref(),
    homeBranch: fields.ref(),
    expired: joi.boolean(),
  });
}

export class CreateMemberDto extends RequestDto {
  static schema = joi.object({
    ...contact,
    name: contact.name.required(),
    membershipType: fields.objectId(),
    homeBranch: fields.objectId(),
    // Links the member to an existing sign-in account (self-service portal).
    userEmail: joi.string().email({ tlds: { allow: false } }).allow(""),
  });
}

export class UpdateMemberDto extends RequestDto {
  static schema = joi
    .object({
      id: fields.objectId(),
      ...contact,
      membershipType: fields.ref(),
      homeBranch: fields.ref(),
      userEmail: joi.string().email({ tlds: { allow: false } }).allow(""),
    })
    .min(2);
}

export class MemberStatusDto extends RequestDto {
  static schema = joi.object({
    id: fields.objectId(),
    reason: joi.string().trim().max(500).allow(""),
  });
}

export class SuspendMemberDto extends RequestDto {
  static schema = joi.object({
    id: fields.objectId(),
    reason: joi.string().trim().min(3).max(500).required(),
  });
}

export const MembershipTypeDtos = crudDtos({
  attributes: {
    code: joi.string().trim().uppercase().max(20).pattern(/^[A-Z0-9_-]+$/),
    name: joi.string().trim().max(100),
    description: joi.string().trim().max(500).allow(""),
    loanLimit: joi.number().integer().min(0).max(1000),
    loanPeriodDays: joi.number().integer().min(1).max(365),
    maxRenewals: joi.number().integer().min(0).max(50),
    reservationLimit: joi.number().integer().min(0).max(100),
    membershipMonths: joi.number().integer().min(1).max(120),
    canAccessDigital: joi.boolean(),
    isActive: joi.boolean(),
  },
  required: ["code", "name", "loanLimit", "loanPeriodDays", "maxRenewals", "reservationLimit", "membershipMonths"],
  filters: { isActive: joi.boolean() },
});

export class MemberResponseDto extends ResponseDto {
  static fields = [
    "_id", "memberNumber", "user", "kind", "name", "email", "phone", "address", "institution",
    "membershipType", "homeBranch", "status", "statusReason", "joinedAt", "expiresAt", "notes",
    "isExpired", "summary", "createdAt", "updatedAt",
  ];
}

export class MembershipTypeResponseDto extends ResponseDto {
  static fields = [
    "_id", "code", "name", "description", "loanLimit", "loanPeriodDays", "maxRenewals",
    "reservationLimit", "membershipMonths", "canAccessDigital", "isActive",
  ];
}

export class MembershipEventResponseDto extends ResponseDto {
  static fields = ["_id", "type", "actor", "details", "createdAt"];
}
