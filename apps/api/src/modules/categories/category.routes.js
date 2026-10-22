import { Router } from "express";
import { CategoryIdDto, CreateCategoryDto, UpdateCategoryDto } from "./category.dto.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../roles/permissions.js";

export function createCategoryRouter({ categoryController, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.CategoriesManage);

  router.get("/", categoryController.listCategories);
  router.get("/:id", validate(CategoryIdDto), categoryController.getCategoryById);
  router.get("/:id/books", validate(CategoryIdDto), categoryController.listCategoryBooks);

  router.post("/", canManage, validate(CreateCategoryDto), categoryController.createCategory);
  router.put("/:id", canManage, validate(UpdateCategoryDto), categoryController.updateCategory);
  router.delete("/:id", canManage, validate(CategoryIdDto), categoryController.deleteCategory);

  return router;
}
