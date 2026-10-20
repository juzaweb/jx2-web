import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";

/**
 * Compact language picker shared by the login screen, character selection and HUD.
 * `variant` only controls placement; the control itself is identical everywhere.
 * @param {{ variant?: "default" | "login" | "character" | "hud" }} props
 */
export function LanguageSwitcher({ variant = "default" }) {
  const { language, setLanguage, t, languages } = useI18n();

  return (
    <label
      className={`language-switcher language-switcher--${variant}`}
      title={t("language.label")}
    >
      <span className="language-switcher-icon" aria-hidden="true">🌐</span>
      <select
        className="language-switcher-select"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label={t("language.label")}
      >
        {languages.map((option) => (
          <option key={option.code} value={option.code}>
            {option.short}
          </option>
        ))}
      </select>
    </label>
  );
}
