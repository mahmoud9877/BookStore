import { loginSchema, signupSchema } from "../utils/auth.validation.js";

const validUser = { userName: "reader", email: "reader@example.com", password: "secret1", cPassword: "secret1" };

test("accepts a valid signup", () => {
  expect(signupSchema.validate(validUser).error).toBeUndefined();
});

test("rejects mismatched password confirmation", () => {
  const { error } = signupSchema.validate({ ...validUser, cPassword: "other" });
  expect(error.details[0].message).toBe("Passwords don't match.");
});

test("rejects short user names", () => {
  expect(signupSchema.validate({ ...validUser, userName: "ab" }).error).toBeDefined();
});

test("requires email and password to log in", () => {
  const { error } = loginSchema.validate({}, { abortEarly: false });
  expect(error.details.map((detail) => detail.path[0])).toEqual(["email", "password"]);
});

test("explains problems in plain language", () => {
  const { error } = signupSchema.validate(
    { userName: "ab", email: "not-an-email", password: "123", cPassword: "123" },
    { abortEarly: false }
  );
  expect(error.details.map((detail) => detail.message)).toEqual([
    "Your name needs at least 3 characters.",
    "Enter a valid email address, like name@example.com.",
    "Your password needs at least 6 characters.",
  ]);
});
