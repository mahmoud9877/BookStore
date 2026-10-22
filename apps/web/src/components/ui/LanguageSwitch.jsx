import React from "react";
import { t, useLanguage } from "../../i18n/index.js";

/**
 * Toggles between English and Arabic. Shows the other language's name in that
 * language ("العربية" / "English"), as language pickers conventionally do.
 */
export default function LanguageSwitch({ className = "btn btn-ghost btn-sm", tone }) {
  const { language, setLanguage } = useLanguage();
  const next = language === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      className={`${className} language-switch ${tone === "light" ? "language-switch-light" : ""}`}
      lang={next}
      aria-label={next === "ar" ? t("Switch to Arabic") : t("Switch to English")}
      onClick={() => setLanguage(next)}
    >
      <i className="bi bi-translate" aria-hidden="true"></i>
      <span>{next === "ar" ? "العربية" : "English"}</span>
    </button>
  );
}
