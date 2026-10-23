import { couponModel } from "./coupon.model.js";
import { BaseRepository } from "../../core/base-repository.js";

/** Codes are stored trimmed and upper-case, so lookups ignore case. */
export const normalizeCode = (code) => String(code ?? "").trim().toUpperCase();

export class CouponRepository extends BaseRepository {
  constructor(model = couponModel) {
    super(model);
  }

  findByCode(code) {
    return this.findOne({ code: normalizeCode(code) });
  }

  /**
   * Takes one use of the coupon, atomically: only while it is active, not
   * expired and under its usage limit. Resolves the updated coupon, or null.
   */
  claim(id, now = new Date()) {
    return this.updateWhere(
      {
        _id: id,
        isActive: true,
        $and: [
          { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
          { $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] },
        ],
      },
      { $inc: { usedCount: 1 } }
    );
  }

  /** Gives back a use claimed by an order that did not go through. */
  release(code) {
    return this.updateWhere({ code: normalizeCode(code), usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }
}
