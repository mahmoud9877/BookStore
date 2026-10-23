import { getCountries, getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString } from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/mobile/examples";

// The country picked by default, and how a number typed without a country code
// ("01012345678") is read. The API checks the same way (apps/api/src/core/phone.js)
// and stores E.164 ("+201012345678").
export const DEFAULT_PHONE_COUNTRY = "EG";

/** Every phone field takes a mobile number: "01012345678", "+20 10 1234 5678", "+44 7911 123456". */
export const isValidMobile = (value) => Boolean(parsePhoneNumberFromString(String(value ?? ""), DEFAULT_PHONE_COUNTRY)?.isValid());

/** A stored number split for the country picker: "+201012345678" -> { country: "EG", national: "1012345678" }. */
export function splitMobile(value) {
  if (!value) return { country: DEFAULT_PHONE_COUNTRY, national: "" };
  const parsed = parsePhoneNumberFromString(String(value), DEFAULT_PHONE_COUNTRY);
  return parsed?.country ? { country: parsed.country, national: parsed.nationalNumber } : { country: DEFAULT_PHONE_COUNTRY, national: String(value) };
}

/** The full number for a picked country and typed digits; "" when nothing is typed. */
export function joinMobile(country, national) {
  const digits = String(national ?? "").trim();
  if (!digits) return "";
  const parsed = parsePhoneNumberFromString(digits, country);
  return parsed?.isValid() ? parsed.number : `+${getCountryCallingCode(country)}${digits.replace(/^0+/, "").replace(/[^\d]/g, "")}`;
}

/**
 * What the number box keeps from typed or pasted text: digits only, with Arabic
 * digits (٠١٢ / ۰۱۲) turned into 0-9. A pasted international number ("+20 10…")
 * also returns its country.
 */
export function cleanMobileInput(text) {
  const latin = String(text ?? "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  if (latin.trim().startsWith("+")) {
    const parsed = parsePhoneNumberFromString(latin);
    if (parsed?.country) return { country: parsed.country, national: parsed.nationalNumber };
  }
  return { country: null, national: latin.replace(/\D/g, "").slice(0, 15) };
}

/** A sample number for the picked country, written the local way: "010 01234567". */
export const mobileExample = (country) => getExampleNumber(country, examples)?.formatNational() ?? "";

/** Every country with its calling code, named in `locale`; the default country first. */
export function mobileCountries(locale) {
  let names;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    names = null; // older browsers: show the ISO code
  }
  const list = getCountries().map((code) => ({ code, dial: getCountryCallingCode(code), name: names?.of(code) ?? code }));
  const collator = new Intl.Collator(locale);
  return [
    ...list.filter((country) => country.code === DEFAULT_PHONE_COUNTRY),
    ...list.filter((country) => country.code !== DEFAULT_PHONE_COUNTRY).sort((a, b) => collator.compare(a.name, b.name)),
  ];
}
