import { parsePhoneNumberFromString as parseAny } from "libphonenumber-js";
import { parsePhoneNumberFromString as parseMobile } from "libphonenumber-js/mobile";

// Numbers written without a country code ("01012345678") are read as Egyptian.
// The API checks the same way (apps/api/src/core/phone.js) and stores E.164.
export const DEFAULT_PHONE_COUNTRY = "EG";

const parse = (value, mobile) => (mobile ? parseMobile : parseAny)(String(value ?? ""), DEFAULT_PHONE_COUNTRY);

/** A mobile number for a person: "01012345678", "+20 10 1234 5678", "+44 7911 123456". */
export const isValidMobile = (value) => Boolean(parse(value, true)?.isValid());

/** Any valid phone number, landlines included (branches, suppliers). */
export const isValidPhone = (value) => Boolean(parse(value, false)?.isValid());
