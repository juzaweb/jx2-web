/**
 * Per-character skill assignments for the U, I, O, P hotkeys.
 *
 * Each key triggers direct skill casting towards target or cursor.
 */

import { SKILL_SLOTS } from "./skills.js";

const STORAGE_PREFIX = "jx2_skill_loadout_";

export const SKILL_KEYS = ["u", "i", "o", "p"];

/**
 * Default loadout: slots 0, 1, 2, 3 mapped to keys u, i, o, p.
 * Keeps left / right aliases pointing to u / i for backward compatibility.
 */
export const DEFAULT_SKILL_LOADOUT = {
  u: 0,
  i: 1,
  o: 2,
  p: 3,
  left: 0,
  right: 1
};

const validSlot = (value, fallback) =>
  Number.isInteger(value) && value >= 0 && value < SKILL_SLOTS ? value : fallback;

const storageKey = (characterId) => `${STORAGE_PREFIX}${characterId || "guest"}`;

/**
 * Load a character's skill loadout.
 * @param {string} [characterId]
 * @returns {{u:number,i:number,o:number,p:number,left:number,right:number}}
 */
export function loadSkillLoadout(characterId) {
  try {
    const raw = localStorage.getItem(storageKey(characterId));
    if (!raw) return { ...DEFAULT_SKILL_LOADOUT };
    const parsed = JSON.parse(raw);
    const u = validSlot(parsed?.u ?? parsed?.left, DEFAULT_SKILL_LOADOUT.u);
    const i = validSlot(parsed?.i ?? parsed?.right, DEFAULT_SKILL_LOADOUT.i);
    const o = validSlot(parsed?.o, DEFAULT_SKILL_LOADOUT.o);
    const p = validSlot(parsed?.p, DEFAULT_SKILL_LOADOUT.p);
    return {
      u,
      i,
      o,
      p,
      left: u,
      right: i
    };
  } catch {
    return { ...DEFAULT_SKILL_LOADOUT };
  }
}

/**
 * Persist a character's skill loadout.
 * @param {string} [characterId]
 * @param {Object} loadout
 * @returns {{u:number,i:number,o:number,p:number,left:number,right:number}} the saved loadout
 */
export function saveSkillLoadout(characterId, loadout) {
  const u = validSlot(loadout?.u ?? loadout?.left, DEFAULT_SKILL_LOADOUT.u);
  const i = validSlot(loadout?.i ?? loadout?.right, DEFAULT_SKILL_LOADOUT.i);
  const o = validSlot(loadout?.o, DEFAULT_SKILL_LOADOUT.o);
  const p = validSlot(loadout?.p, DEFAULT_SKILL_LOADOUT.p);
  const safe = {
    u,
    i,
    o,
    p,
    left: u,
    right: i
  };
  try {
    localStorage.setItem(storageKey(characterId), JSON.stringify(safe));
  } catch {
    // Ignore storage failures; the in-memory session still works.
  }
  return safe;
}
