import { asyncHandler } from "../../middleware/error-handler.js";

export class CategoryController {
  #categoryService;

  constructor(categoryService) {
    this.#categoryService = categoryService;
  }

  listCategories = asyncHandler(async (req, res) => {
    return res.status(200).json(await this.#categoryService.listCategories());
  });

  listCategoryOptions = (req, res) => {
    return res.status(200).json({ categories: this.#categoryService.listCategoryOptions() });
  };

  getCategoryById = asyncHandler(async (req, res) => {
    return res.status(200).json(await this.#categoryService.getCategory(req.dto.id));
  });

  createCategory = asyncHandler(async (req, res) => {
    const category = await this.#categoryService.createCategory(req.dto);
    return res.status(201).json({ message: "Category created successfully", category });
  });

  updateCategory = asyncHandler(async (req, res) => {
    const category = await this.#categoryService.updateCategory(req.dto);
    return res.status(200).json({ message: "Category updated successfully", category });
  });

  deleteCategory = asyncHandler(async (req, res) => {
    await this.#categoryService.deleteCategory(req.dto.id);
    return res.status(200).json({ message: "Category deleted successfully" });
  });
}
