import { Router } from "express";
import { CategoryIdDto, CreateCategoryDto, UpdateCategoryDto } from "./category.dto.js";
import { validate } from "../../middleware/validate.js";

export function createCategoryRouter({ categoryController, authGuard }) {
  const router = Router();
  const adminOnly = authGuard.adminOnly();

  router.get("/", categoryController.listCategories);
  // Must be registered before "/:id", otherwise "options" is treated as an id.
  router.get("/options", categoryController.listCategoryOptions);
  router.get("/:id", validate(CategoryIdDto), categoryController.getCategoryById);

  router.post("/", adminOnly, validate(CreateCategoryDto), categoryController.createCategory);
  router.put("/:id", adminOnly, validate(UpdateCategoryDto), categoryController.updateCategory);
  router.delete("/:id", adminOnly, validate(CategoryIdDto), categoryController.deleteCategory);

  return router;
}
