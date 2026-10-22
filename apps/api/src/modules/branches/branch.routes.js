import { Router } from "express";
import { crudRouter } from "../../core/crud-routes.js";
import { CrudController } from "../../core/crud-controller.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { PERMISSIONS } from "../roles/permissions.js";
import { BranchDtos, LocationDtos } from "./branch.dto.js";

export function createBranchRouter({ branchService, authGuard }) {
  const router = Router();
  // Public: members pick a pickup branch; the catalogue shows availability per branch.
  router.get("/active", asyncHandler(async (req, res) => res.json({ data: await branchService.listActive() })));
  router.use(
    crudRouter({
      controller: new CrudController(branchService),
      dtos: BranchDtos,
      write: authGuard.requirePermission(PERMISSIONS.BranchesManage),
      read: authGuard.signedIn(),
    })
  );
  return router;
}

export function createLocationRouter({ locationService, authGuard }) {
  return crudRouter({
    controller: new CrudController(locationService),
    dtos: LocationDtos,
    write: authGuard.requirePermission(PERMISSIONS.BranchesManage),
    read: authGuard.requirePermission(PERMISSIONS.BranchesManage, PERMISSIONS.CopiesManage, PERMISSIONS.InventoryManage),
  });
}
