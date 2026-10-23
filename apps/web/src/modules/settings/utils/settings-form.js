import { toMinorUnits } from "../../../lib/format.js";

// Amounts the API stores in minor units; the form edits them in major units.
const MONEY_FIELDS = [
  ["circulation", "blockBorrowingAboveBalance", true],
  ["fines", "overduePerDay", false],
  ["fines", "maxOverduePerLoan", true],
  ["fines", "lostItemFee", true],
  ["fines", "damagedItemFee", false],
];

const toMajor = (minor) => (minor == null ? "" : String(minor / 100));

/** Settings from the API -> form values (money as major-unit strings; nullable ones may be ""). */
export function toForm({ version, ...settings }) {
  const form = JSON.parse(JSON.stringify(settings));
  for (const [section, key] of MONEY_FIELDS) form[section][key] = toMajor(settings[section][key]);
  return { form, version };
}

/** Form values -> the PUT /settings body (minor units; "" -> null where the policy can be switched off). */
export function toPayload(form, version) {
  const payload = JSON.parse(JSON.stringify(form));
  for (const [section, key, nullable] of MONEY_FIELDS) {
    const value = form[section][key];
    payload[section][key] = value === "" || value == null ? (nullable ? null : 0) : toMinorUnits(value);
  }
  return { ...payload, version };
}
