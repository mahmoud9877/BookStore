import { asyncHandler } from "../../middleware/error-handler.js";
import { categoryModel, CATEGORY_OPTIONS } from "./category.model.js";

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoryModel.find({});
  res.status(200).json(categories);
});

export const listCategoryOptions = asyncHandler(async (req, res) => {
  res.status(200).json({ categories: CATEGORY_OPTIONS });
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryModel.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }
  return res.status(200).json(category);
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryModel.create({ name: req.body.name });
  res.status(201).json({ message: "Category created successfully", category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!CATEGORY_OPTIONS.includes(name)) {
    return res.status(400).json({
      error: `Invalid category name. Choose from: ${CATEGORY_OPTIONS.join(", ")}`,
    });
  }
  const category = await categoryModel.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }
  category.name = name;
  await category.save();
  return res
    .status(200)
    .json({ message: "Category updated successfully", category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await categoryModel.findByIdAndDelete(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }
  return res.status(200).json({ message: "Category deleted successfully" });
});
