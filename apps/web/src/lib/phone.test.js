import { isValidMobile, isValidPhone } from "./phone.js";
import { checkoutSchema } from "../modules/cart/checkout.validation.js";

test("mobile numbers: local Egyptian and international forms", () => {
  for (const phone of ["01012345678", "010 1234 5678", "+20 10 1234 5678", "+44 7911 123456"]) expect(isValidMobile(phone)).toBe(true);
  for (const phone of ["0223456789", "12345", "call me", ""]) expect(isValidMobile(phone)).toBe(false);
});

test("branch and supplier phones also accept landlines", () => {
  expect(isValidPhone("02 2345 6789")).toBe(true);
  expect(isValidPhone("01012345678")).toBe(true);
  expect(isValidPhone("12345")).toBe(false);
});

test("checkout needs a mobile number the courier can call", () => {
  const order = { address: "1 Nile Street", note: "", paymentType: "cash" };
  expect(checkoutSchema.validate({ ...order, phone: "01012345678" }).error).toBeUndefined();
  expect(checkoutSchema.validate({ ...order, phone: "0223456789" }).error.details[0].message).toBe("Enter a valid mobile number.");
  expect(checkoutSchema.validate({ ...order, phone: "" }).error.details[0].message).toBe("Enter a phone number so the courier can reach you.");
});
