import { asyncHandler } from "../../utils/errorHandling.js";
import {
  categoryModel,
  CATEGORY_OPTIONS,
} from "../../../DB/modules/categoryModel.js";

// Get all categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await categoryModel.find({});
  res.status(200).json(categories);
});

// Get predefined category options
export const getCategoryOptions = asyncHandler(async (req, res) => {
  res.status(200).json({ categories: CATEGORY_OPTIONS });
});

// Get a single category by ID
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryModel.findById(req.params.id);
  if (category) {
    res.status(200).json(category);
  } else {
    res.status(404).json({ message: "Category not found" });
  }
});

// Create a new category
export const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  // if (!CATEGORY_OPTIONS.includes(name)) {
  //   return res.status(400).json({
  //     error: `Invalid category name. Choose from: ${CATEGORY_OPTIONS.join(
  //       ", "
  //     )}`,
  //   });
  // }
  const category = new categoryModel({ name });
  await category.save();
  res.status(201).json({ message: "Category created successfully", category });
});

// Update an existing category by ID
export const updateCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!CATEGORY_OPTIONS.includes(name)) {
    return res.status(400).json({
      error: `Invalid category name. Choose from: ${CATEGORY_OPTIONS.join(
        ", "
      )}`,
    });
  }
  const category = await categoryModel.findById(req.params.id);
  if (category) {
    category.name = name;
    await category.save();
    res
      .status(200)
      .json({ message: "Category updated successfully", category });
  } else {
    res.status(404).json({ message: "Category not found" });
  }
});

// Delete a category by ID
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await categoryModel.findById(req.params.id);
  if (category) {
    await category.remove();
    res.status(200).json({ message: "Category deleted successfully" });
  } else {
    res.status(404).json({ message: "Category not found" });
  }
});
