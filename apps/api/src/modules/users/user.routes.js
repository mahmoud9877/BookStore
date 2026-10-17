import { Router } from "express";

/** Mounted under /auth: GET /auth/user is the established public path. */
export function createUserRouter({ userController, authGuard }) {
  const router = Router();

  router.get("/user", authGuard.adminOnly(), userController.listUsers);

  return router;
}
