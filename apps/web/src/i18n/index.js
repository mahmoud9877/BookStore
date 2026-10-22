import { useLanguageStore, currentLanguage, currentLocale, LANGUAGES } from "./language.store.js";
import { AR, AR_PLURAL_TABLE, EN_PLURAL_TABLE } from "./ar/index.js";

/*
 * Translation, gettext style: the English text IS the key, so English needs no
 * dictionary and an untranslated string falls back to English instead of
 * showing a key. Arabic lives in i18n/ar/*.js. A test (i18n.test.js) checks that
 * every t("…")/msg("…")/tp("…") used in the code has an Arabic entry and that no
 * English text is left in JSX without t().
 *
 *   t("Check out")                       → "إعارة"
 *   t("Due {date}", { date })            → "مستحق في {date}"
 *   tp("books", 3)                       → "3 كتب"   (plural rules per language)
 *   msg("Loans")                         → "Loans"  (marks a string in a constant;
 *                                           translate it where it is rendered: t(label))
 *
 * The app re-renders its whole tree when the language changes (App.jsx), so
 * calling t() anywhere — components, toasts, constants rendered later — is safe.
 */

const fill = (text, vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] == null ? match : String(vars[name]))) : text;

export function t(text, vars) {
  if (text == null) return "";
  const translated = currentLanguage() === "ar" ? AR[text] ?? text : text;
  return fill(translated, vars);
}

const pluralRules = {};
const rulesFor = (locale) => (pluralRules[locale] ??= new Intl.PluralRules(locale));

/** A plural message by id (see the plural tables in i18n/ar/*.js). */
export function tp(id, count, vars = {}) {
  const language = currentLanguage();
  const table = language === "ar" ? AR_PLURAL_TABLE[id] ?? EN_PLURAL_TABLE[id] : EN_PLURAL_TABLE[id];
  if (!table) return `${count}`;
  const category = rulesFor(LANGUAGES[language].locale).select(count);
  const text = table[category] ?? table.other;
  return fill(text, { ...vars, count: new Intl.NumberFormat(currentLocale()).format(count) });
}

/** Marks text for translation without translating it yet (constants). */
export const msg = (text) => text;

/** `{ language, dir, setLanguage }` — re-renders when the language changes. */
export function useLanguage() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  return { language, dir: LANGUAGES[language].dir, setLanguage };
}

export { LANGUAGES, currentLanguage, currentLocale };
