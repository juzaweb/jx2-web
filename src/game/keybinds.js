/**
 * Player-configurable skill hotkeys.
 *
 * A hotkey only *selects* the skill into the right-hand slot; the actual cast is
 * the right mouse button. Bindings are stored per character so switching
 * characters does not leak another hero's layout.
 */

import { SKILL_SLOTS } from "./skills.js";

/** Default selection keys for the six skill slots. */
export const DEFAULT_SKILL_BINDS = ["q", "w", "e", "r", "t", "y"];

/** Keys the player may not rebind because the UI already owns them. */
export const RESERVED_KEYS = new Set(["1", "2", "3", "4", "f3", "f4", "m", "escape", "tab", "enter"]);

const STORAGE_PREFIX = "jx2_skill_binds_";

/**
 * Normalise a keyboard event or raw key string to a stable lowercase token.
 * @param {KeyboardEvent|string} input
 * @returns {string}
 */
export function normalizeKey(input) {
  const raw = typeof input === "string" ? input : input?.key;
  if (typeof raw !== "string" || raw.length === 0) return "";
  if (raw === " ") return "space";
  return raw.toLowerCase();
}

/**
 * Whether a normalized key is reserved by the UI.
 * @param {string} key
 * @returns {boolean}
 */
export const isReservedKey = (key) => RESERVED_KEYS.has(key);

/**
 * A fresh copy of the default bindings.
 * @returns {string[]}
 */
export const defaultSkillBinds = () => [...DEFAULT_SKILL_BINDS];

const storageKey = (characterId) => `${STORAGE_PREFIX}${characterId || "guest"}`;

/**
 * Load a character's bindings, filling any missing slot with its default.
 * Corrupt stored data falls back to the defaults.
 * @param {string} [characterId]
 * @returns {string[]}
 */
export function loadSkillBinds(characterId) {
  const defaults = defaultSkillBinds();
  try {
    const raw = localStorage.getItem(storageKey(characterId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    return defaults.map((fallback, slot) => {
      const value = typeof parsed[slot] === "string" ? normalizeKey(parsed[slot]) : "";
      return value || fallback;
    });
  } catch {
    return defaults;
  }
}

/**
 * Persist a character's bindings.
 * @param {string} [characterId]
 * @param {string[]} binds
 * @returns {string[]} the saved bindings
 */
export function saveSkillBinds(characterId, binds) {
  const safe = defaultSkillBinds().map((fallback, slot) =>
    typeof binds?.[slot] === "string" && binds[slot] ? normalizeKey(binds[slot]) : fallback
  );
  try {
    localStorage.setItem(storageKey(characterId), JSON.stringify(safe));
  } catch {
    // Ignore storage failures (private mode, quota); the session copy still works.
  }
  return safe;
}

/**
 * Assign a key to a slot.
 * @param {string[]} binds
 * @param {number} slot
 * @param {string} key
 * @returns {{ ok: boolean, binds: string[], error?: string }}
 */
export function setSkillBind(binds, slot, key) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SKILL_SLOTS) {
    return { ok: false, binds, error: "invalid-slot" };
  }
  const normalized = normalizeKey(key);
  if (!normalized) return { ok: false, binds, error: "empty" };
  if (isReservedKey(normalized)) return { ok: false, binds, error: "reserved" };
  if (binds.some((bound, index) => index !== slot && bound === normalized)) {
    return { ok: false, binds, error: "duplicate" };
  }
  const next = [...binds];
  next[slot] = normalized;
  return { ok: true, binds: next };
}

/**
 * Build a key-token -> slot lookup for the game's keydown listener.
 * @param {string[]} binds
 * @returns {Map<string, number>}
 */
export function keyToSlot(binds) {
  const map = new Map();
  (binds || []).forEach((key, slot) => {
    const normalized = normalizeKey(key);
    if (normalized) map.set(normalized, slot);
  });
  return map;
}
