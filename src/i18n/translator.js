import vi from "./locales/vi.js";
import en from "./locales/en.js";
import zh from "./locales/zh.js";

const STORAGE_KEY = "jx2_language";
export const FALLBACK_LANGUAGE = "vi";
export const LANGUAGE_CHANGED_EVENT = "jx2:language-changed";

export const LANGUAGES = [
  { code: "vi", short: "VI", labelKey: "language.vi" },
  { code: "en", short: "EN", labelKey: "language.en" },
  { code: "zh", short: "中文", labelKey: "language.zh" }
];

const DICTIONARIES = { vi, en, zh };
const SUPPORTED = new Set(Object.keys(DICTIONARIES));

export const normalizeLanguage = (value) => {
  if (typeof value !== "string") return null;
  const code = value.toLowerCase();
  if (SUPPORTED.has(code)) return code;
  if (code.startsWith("zh")) return "zh";
  if (code.startsWith("vi")) return "vi";
  if (code.startsWith("en")) return "en";
  return null;
};

export const detectLanguage = () => {
  try {
    const stored = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage can be unavailable (private mode / SSR); fall through.
  }

  try {
    return normalizeLanguage(window.navigator.language) || FALLBACK_LANGUAGE;
  } catch {
    return FALLBACK_LANGUAGE;
  }
};

let runtimeLanguage = detectLanguage();

export const setRuntimeLanguage = (next) => {
  const normalized = normalizeLanguage(next);
  if (!normalized) return runtimeLanguage;
  if (normalized === runtimeLanguage) return runtimeLanguage;
  runtimeLanguage = normalized;
  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures; the choice still applies for this session.
  }
  try {
    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: normalized } })
    );
  } catch {
    // No window/CustomEvent (tests/SSR); listeners simply do not exist.
  }
  return runtimeLanguage;
};

const resolve = (dictionary, key) => {
  if (!dictionary || typeof key !== "string") return undefined;
  const value = key
    .split(".")
    .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), dictionary);
  return typeof value === "string" ? value : undefined;
};

const interpolate = (template, params) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
};

/**
 * Translate using an explicit language, falling back to Vietnamese and then to
 * the supplied fallback (or the key itself).
 * @param {string} language
 * @param {string} key
 * @param {object} [params]
 * @param {string} [fallback]
 * @returns {string}
 */
export function translateFor(language, key, params, fallback) {
  const normalized = normalizeLanguage(language) || FALLBACK_LANGUAGE;
  const template =
    resolve(DICTIONARIES[normalized], key) ?? resolve(DICTIONARIES[FALLBACK_LANGUAGE], key);
  if (template === undefined) return fallback ?? key;
  return interpolate(template, params);
}

/**
 * Translate using the current runtime language. Safe to call from non-React
 * code such as the Phaser world manager.
 * @param {string} key
 * @param {object} [params]
 * @param {string} [fallback]
 * @returns {string}
 */
export function translate(key, params, fallback) {
  return translateFor(runtimeLanguage, key, params, fallback);
}
