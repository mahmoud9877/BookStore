import joi from "joi";
import { COUPON_TYPES } from "./coupon.model.js";
import { RequestDto, ResponseDto, crudDtos } from "../../core/dto.js";

export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;

const code = joi.string().trim().uppercase().pattern(COUPON_CODE_PATTERN);

export const CouponDtos = crudDtos({
  attributes: {
    code,
    type: joi.string().valid(...Object.values(COUPON_TYPES)),
    // percent coupons are further limited to 1–100 (CouponService.beforeWrite).
    value: joi.number().positive(),
    minOrder: joi.number().min(0),
    expiresAt: joi.date().iso().allow("", null),
    maxUses: joi.number().integer().min(1).allow("", null),
    isActive: joi.boolean(),
    // Server-managed: accepted so a form can send the record back, then dropped.
    usedCount: joi.any().strip(),
  },
  required: ["code", "type", "value"],
  filters: { isActive: joi.boolean() },
  sortable: ["code", "createdAt", "expiresAt", "usedCount"],
  defaultSort: "-createdAt",
});

/** POST /coupons/check. */
export class CheckCouponDto extends RequestDto {
  static schema = joi.object({ code: joi.string().trim().max(60).required() });
}

export class CouponResponseDto extends ResponseDto {
  static fields = ["_id", "code", "type", "value", "minOrder", "expiresAt", "maxUses", "usedCount", "isActive", "createdAt"];
}

export class CouponCheckResponseDto extends ResponseDto {
  static fields = ["code", "type", "value", "subtotal", "discount", "total"];
}
