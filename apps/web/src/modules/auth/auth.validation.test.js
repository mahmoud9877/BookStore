import { loginSchema, signupSchema } from "./auth.validation.js";

const validUser = { userName: "reader", email: "reader@example.com", password: "secret1", cPassword: "secret1" };

test("accepts a valid signup", () => {
  expect(signupSchema.validate(validUser).error).toBeUndefined();
});

test("rejects mismatched password confirmation", () => {
  const { error } = signupSchema.validate({ ...validUser, cPassword: "other" });
  expect(error.details[0].message).toBe("Passwords do not match.");
});

test("rejects short user names", () => {
  expect(signupSchema.validate({ ...validUser, userName: "ab" }).error).toBeDefined();
});

test("requires email and password to log in", () => {
  const { error } = loginSchema.validate({}, { abortEarly: false });
  expect(error.details.map((detail) => detail.path[0])).toEqual(["email", "password"]);
});
