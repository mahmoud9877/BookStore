import { cleanMobileInput, isValidMobile, joinMobile, mobileCountries, splitMobile } from "./phone.js";
import { checkoutSchema } from "../modules/cart/checkout.validation.js";

test("mobile numbers: local Egyptian and international forms", () => {
  for (const phone of ["01012345678", "010 1234 5678", "+20 10 1234 5678", "+44 7911 123456"]) expect(isValidMobile(phone)).toBe(true);
  for (const phone of ["0223456789", "12345", "call me", ""]) expect(isValidMobile(phone)).toBe(false);
});

test("checkout needs a mobile number the courier can call", () => {
  const order = { address: "1 Nile Street", note: "", paymentType: "cash" };
  expect(checkoutSchema.validate({ ...order, phone: "01012345678" }).error).toBeUndefined();
  expect(checkoutSchema.validate({ ...order, phone: "0223456789" }).error.details[0].message).toBe("Enter a valid mobile number.");
  expect(checkoutSchema.validate({ ...order, phone: "" }).error.details[0].message).toBe("Enter a mobile number so the courier can reach you.");
});

test("the country picker splits and joins numbers", () => {
  expect(splitMobile("+201012345678")).toEqual({ country: "EG", national: "1012345678" });
  expect(splitMobile("")).toEqual({ country: "EG", national: "" });
  expect(joinMobile("EG", "010 1234 5678")).toBe("+201012345678");
  expect(joinMobile("SA", "051 234 5678")).toBe("+966512345678");
  expect(joinMobile("EG", "")).toBe("");
  expect(isValidMobile(joinMobile("EG", "12345"))).toBe(false);
  expect(mobileCountries("en")[0]).toEqual({ code: "EG", dial: "20", name: "Egypt" });
});

test("the number box keeps digits only", () => {
  expect(cleanMobileInput("010abc 1234-5678")).toEqual({ country: null, national: "01012345678" });
  expect(cleanMobileInput("hello")).toEqual({ country: null, national: "" });
  expect(cleanMobileInput("٠١٠١٢٣٤٥٦٧٨")).toEqual({ country: null, national: "01012345678" });
  expect(cleanMobileInput("+966 51 234 5678")).toEqual({ country: "SA", national: "512345678" });
});
