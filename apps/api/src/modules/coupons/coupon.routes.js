import { Router } from "express";
import { crudRouter } from "../../core/crud-routes.js";
import { CrudController } from "../../core/crud-controller.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { PERMISSIONS } from "../roles/permissions.js";
import { CheckCouponDto, CouponDtos } from "./coupon.dto.js";

export function createCouponRouter({ couponService, authGuard }) {
  const router = Router();

  // Any signed-in customer may price a code against their own cart.
  router.post(
    "/check",
    authGuard.signedIn(),
    validate(CheckCouponDto),
    asyncHandler(async (req, res) => res.json({ data: await couponService.check(req.user._id, req.dto.code) }))
  );

  router.use(
    crudRouter({
      controller: new CrudController(couponService),
      dtos: CouponDtos,
      write: authGuard.requirePermission(PERMISSIONS.OrdersManage),
    })
  );
  return router;
}
