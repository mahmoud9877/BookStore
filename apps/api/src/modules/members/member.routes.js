import { Router } from "express";
import { crudRouter } from "../../core/crud-routes.js";
import { CrudController } from "../../core/crud-controller.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../roles/permissions.js";
import {
  CreateMemberDto, ListMembersDto, MemberIdDto, MemberStatusDto, MembershipTypeDtos, SuspendMemberDto, UpdateMemberDto,
} from "./member.dto.js";

const P = PERMISSIONS;

export function createMemberRouter({ memberController, authGuard }) {
  const router = Router();
  const canRead = authGuard.requirePermission(P.MembersRead, P.MembersManage, P.CirculationManage);
  const canManage = authGuard.requirePermission(P.MembersManage);

  router.get("/me", authGuard.signedIn(), memberController.getOwn);
  router.get("/", authGuard.requirePermission(P.MembersRead, P.MembersManage), validate(ListMembersDto), memberController.list);
  router.get("/number/:memberNumber", authGuard.requirePermission(P.CirculationManage, P.MembersRead, P.MembersManage), memberController.getByNumber);
  router.get("/:id", canRead, validate(MemberIdDto), memberController.get);
  router.get("/:id/history", canRead, validate(MemberIdDto), memberController.history);
  router.post("/", canManage, validate(CreateMemberDto), memberController.register);
  router.patch("/:id", canManage, validate(UpdateMemberDto), memberController.update);
  router.post("/:id/renew", canManage, validate(MemberIdDto), memberController.renew);
  router.post("/:id/suspend", canManage, validate(SuspendMemberDto), memberController.suspend);
  router.post("/:id/reactivate", canManage, validate(MemberStatusDto), memberController.reactivate);
  router.post("/:id/cancel", canManage, validate(MemberStatusDto), memberController.cancel);

  return router;
}

export const createMembershipTypeRouter = ({ membershipTypeService, authGuard }) =>
  crudRouter({
    controller: new CrudController(membershipTypeService),
    dtos: MembershipTypeDtos,
    write: authGuard.requirePermission(P.SettingsManage),
    read: authGuard.signedIn(),
  });
