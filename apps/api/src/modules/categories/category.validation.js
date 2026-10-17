import joi from "joi";
import { generalFields } from "../../middleware/validate.js";

export const categoryIdParam = joi.object({ id: generalFields.id });

export const createCategory = joi.object({
  name: joi.string().trim().required(),
});

export const updateCategory = joi.object({
  id: generalFields.id,
  name: joi.string().trim().required(),
});
