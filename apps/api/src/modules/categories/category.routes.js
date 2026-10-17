import { Router } from "express";
import * as categoryController from "./category.controller.js";
import * as validators from "./category.validation.js";
import { USER_ROLES } from "../users/user.roles.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();
const adminOnly = authenticate([USER_ROLES.Admin]);

router.get("/", categoryController.listCategories);
// Must be registered before "/:id", otherwise "options" is treated as an id.
router.get("/options", categoryController.listCategoryOptions);
router.get("/:id", validate(validators.categoryIdParam), categoryController.getCategoryById);

router.post("/", adminOnly, validate(validators.createCategory), categoryController.createCategory);
router.put("/:id", adminOnly, validate(validators.updateCategory), categoryController.updateCategory);
router.delete("/:id", adminOnly, validate(validators.categoryIdParam), categoryController.deleteCategory);

export default router;
