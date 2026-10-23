import { CrudService } from "../../core/crud-service.js";
import { BadRequestError } from "../../core/http-errors.js";
import { round2 } from "../books/book-pricing.js";
import { COUPON_TYPES } from "./coupon.model.js";
import { couponDiscount, couponProblem } from "./coupon-rules.js";
import { CouponCheckResponseDto, CouponResponseDto } from "./coupon.dto.js";

/** Shop coupons: CRUD for staff (orders:manage) and a price check for customers. */
export class CouponService extends CrudService {
  static entity = "Coupon";
  static searchFields = ["code"];
  static Dto = CouponResponseDto;

  #carts;

  constructor({ couponRepository, cartService, auditService }) {
    super({ repository: couponRepository, auditService });
    this.#carts = cartService;
  }

  async beforeWrite(data, existing) {
    for (const name of ["expiresAt", "maxUses"]) if (data[name] === "") data[name] = null;
    const type = data.type ?? existing?.type;
    const value = data.value ?? existing?.value;
    if (type === COUPON_TYPES.percent && (value < 1 || value > 100)) {
      throw new BadRequestError("A percentage coupon must be between 1 and 100");
    }
  }

  /** What `code` takes off the user's cart at current prices. */
  async check(userId, code) {
    const { items, subtotal } = await this.#carts.pricedCart(userId);
    if (!items.length) throw new BadRequestError("Empty Cart");
    const coupon = await this.repository.findByCode(code);
    const problem = couponProblem(coupon, subtotal);
    if (problem) throw new BadRequestError(problem);
    const discount = couponDiscount(coupon, subtotal);
    return CouponCheckResponseDto.from({ ...coupon, subtotal, discount, total: round2(subtotal - discount) });
  }
}
