import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  LANGUAGES,
  detectLanguage,
  normalizeLanguage,
  setRuntimeLanguage,
  translateFor
} from "./translator.js";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(detectLanguage);

  const setLanguage = useCallback((next) => {
    const normalized = normalizeLanguage(next);
    if (!normalized) return;
    setLanguageState(normalized);
  }, []);

  const t = useCallback(
    (key, params, fallback) => translateFor(language, key, params, fallback),
    [language]
  );

  useEffect(() => {
    setRuntimeLanguage(language);
    try {
      document.documentElement.lang = language;
      document.title = t("app.title");
    } catch {
      // No DOM in tests; nothing to update.
    }
  }, [language, t]);

  const value = useMemo(
    () => ({ language, setLanguage, t, languages: LANGUAGES }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside an I18nProvider");
  }
  return context;
}
