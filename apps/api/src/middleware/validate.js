import joi from "joi";
import { Types } from "mongoose";

const validateObjectId = (value, helper) => {
  return Types.ObjectId.isValid(value)
    ? value
    : helper.message("Invalid ObjectId");
};

export const generalFields = {
  email: joi
    .string()
    .email({
      minDomainSegments: 2,
      maxDomainSegments: 4,
      tlds: { allow: ["com", "net"] },
    })
    .required(),
  password: joi
    .string()
    .pattern(new RegExp(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/))
    .required(),
  cPassword: joi.string().required(),
  id: joi.string().custom(validateObjectId).required(),
  file: joi.object({
    size: joi.number().positive().required(),
    path: joi.string().required(),
    filename: joi.string().required(),
    destination: joi.string().required(),
    mimetype: joi.string().required(),
    encoding: joi.string().required(),
    originalname: joi.string().required(),
    fieldname: joi.string().required(),
  }),
};

/** Validates the merged body, route params and query string against a Joi schema. */
export const validate = (schema) => {
  return (req, res, next) => {
    const input = { ...req.body, ...req.params, ...req.query };
    const { error } = schema.validate(input, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: "validationErr",
        validationErr: error.details,
      });
    }
    return next();
  };
};
