import { Router } from "express";
import * as regPage from "./auth.controller.js";
const router = Router();
router.post("/signup", regPage.signup);
router.get("/user", regPage.getAll);
router.post("/login", regPage.login);

export default router;
