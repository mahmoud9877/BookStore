import Joi from "joi";
import { fieldErrors } from "./FormField.jsx";

test("keeps the first message per field and capitalises it", () => {
  const schema = Joi.object({ email: Joi.string().email().required(), age: Joi.number().min(18) });
  const { error } = schema.validate({ email: "x", age: 3 }, { abortEarly: false });
  expect(fieldErrors(error)).toEqual({
    email: "Must be a valid email",
    age: "Must be greater than or equal to 18",
  });
  expect(fieldErrors(undefined)).toEqual({});
});
