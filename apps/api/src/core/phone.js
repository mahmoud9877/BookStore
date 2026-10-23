import joi from "joi";
import { parsePhoneNumberFromString } from "libphonenumber-js/mobile";

// Numbers written without a country code ("01012345678") are read as Egyptian.
// Keep in sync with apps/web/src/lib/phone.js.
export const DEFAULT_PHONE_COUNTRY = "EG";

/** The mobile number in E.164 ("+201012345678"), or null when it is not a valid mobile number. */
export function normalizeMobile(value) {
  const parsed = parsePhoneNumberFromString(String(value ?? ""), DEFAULT_PHONE_COUNTRY);
  return parsed?.isValid() ? parsed.number : null;
}

/** A Joi string that must be a valid mobile number and is converted to E.164. */
export const mobileField = () =>
  joi
    .string()
    .trim()
    .max(40)
    .custom((value, helpers) => normalizeMobile(value) ?? helpers.error("phone.invalid"))
    .messages({ "phone.invalid": "Enter a valid mobile number." });
