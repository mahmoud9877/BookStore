import joi from "joi";
import { parsePhoneNumberFromString as parseAny } from "libphonenumber-js";
import { parsePhoneNumberFromString as parseMobile } from "libphonenumber-js/mobile";

// Numbers written without a country code ("01012345678") are read as Egyptian.
// Keep in sync with apps/web/src/lib/phone.js.
export const DEFAULT_PHONE_COUNTRY = "EG";

/** The number in E.164 ("+201012345678"), or null when it is not a valid (mobile) number. */
export function normalizePhone(value, { mobile = false } = {}) {
  const parsed = (mobile ? parseMobile : parseAny)(String(value ?? ""), DEFAULT_PHONE_COUNTRY);
  return parsed?.isValid() ? parsed.number : null;
}

/** A Joi string that must be a valid phone number and is converted to E.164. */
export const phoneField = ({ mobile }) =>
  joi
    .string()
    .trim()
    .max(40)
    .custom((value, helpers) => normalizePhone(value, { mobile }) ?? helpers.error("phone.invalid"))
    .messages({ "phone.invalid": mobile ? "Enter a valid mobile number." : "Enter a valid phone number." });
