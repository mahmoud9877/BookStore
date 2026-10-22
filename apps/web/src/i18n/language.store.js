import { create } from "zustand";

export const LANGUAGES = Object.freeze({
  en: { code: "en", label: "English", dir: "ltr", locale: "en" },
  // Latin digits keep barcodes, card numbers and amounts consistent across languages.
  ar: { code: "ar", label: "العربية", dir: "rtl", locale: "ar-EG-u-nu-latn" },
});

// Also read by the inline script in public/index.html, before React starts.
export const LANGUAGE_STORAGE_KEY = "language";

function initialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (LANGUAGES[saved]) return saved;
  } catch {
    // Storage unavailable (private mode): fall through to the browser language.
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en";
}

/**
 * Applies a language to the document: `lang`/`dir` on <html> and the matching
 * Bootstrap build (bootstrap.rtl.min.css mirrors every component and utility).
 */
export function applyToDocument(code) {
  if (typeof document === "undefined") return;
  const { dir } = LANGUAGES[code];
  document.documentElement.lang = code;
  document.documentElement.dir = dir;
  const bootstrap = document.getElementById("bootstrap-css");
  if (bootstrap) {
    const href = bootstrap.getAttribute("href").replace(/bootstrap(\.rtl)?\.min\.css$/, dir === "rtl" ? "bootstrap.rtl.min.css" : "bootstrap.min.css");
    if (href !== bootstrap.getAttribute("href")) bootstrap.setAttribute("href", href);
  }
}

/** The interface language (persisted per browser). */
export const useLanguageStore = create((set) => ({
  language: initialLanguage(),
  setLanguage(code) {
    if (!LANGUAGES[code]) return;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    } catch {
      // Not persisted; the choice still applies to this visit.
    }
    applyToDocument(code);
    set({ language: code });
  },
}));

applyToDocument(useLanguageStore.getState().language);

export const currentLanguage = () => useLanguageStore.getState().language;
export const currentLocale = () => LANGUAGES[currentLanguage()].locale;
export const isRtl = () => LANGUAGES[currentLanguage()].dir === "rtl";
