/**
 * Per-character skill assignments for the two mouse buttons.
 *
 * `left` is cast by left-clicking an enemy (the hero runs into range first).
 * `right` is cast by right-clicking: on an enemy it runs into range, on empty
 * ground it releases in place.
 */

import { SKILL_SLOTS } from "./skills.js";

const STORAGE_PREFIX = "jx2_skill_loadout_";

/** Default loadout: La Hán Quyền on the left, Ca Diệp Thoái on the right. */
export const DEFAULT_SKILL_LOADOUT = { left: 0, right: 1 };

const validSlot = (value, fallback) =>
  Number.isInteger(value) && value >= 0 && value < SKILL_SLOTS ? value : fallback;

const storageKey = (characterId) => `${STORAGE_PREFIX}${characterId || "guest"}`;

/**
 * Load a character's mouse-button loadout.
 * @param {string} [characterId]
 * @returns {{left:number,right:number}}
 */
export function loadSkillLoadout(characterId) {
  try {
    const raw = localStorage.getItem(storageKey(characterId));
    if (!raw) return { ...DEFAULT_SKILL_LOADOUT };
    const parsed = JSON.parse(raw);
    return {
      left: validSlot(parsed?.left, DEFAULT_SKILL_LOADOUT.left),
      right: validSlot(parsed?.right, DEFAULT_SKILL_LOADOUT.right)
    };
  } catch {
    return { ...DEFAULT_SKILL_LOADOUT };
  }
}

/**
 * Persist a character's mouse-button loadout.
 * @param {string} [characterId]
 * @param {{left:number,right:number}} loadout
 * @returns {{left:number,right:number}} the saved loadout
 */
export function saveSkillLoadout(characterId, loadout) {
  const safe = {
    left: validSlot(loadout?.left, DEFAULT_SKILL_LOADOUT.left),
    right: validSlot(loadout?.right, DEFAULT_SKILL_LOADOUT.right)
  };
  try {
    localStorage.setItem(storageKey(characterId), JSON.stringify(safe));
  } catch {
    // Ignore storage failures; the in-memory session still works.
  }
  return safe;
}
