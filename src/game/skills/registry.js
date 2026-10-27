/**
 * Skill registry: the flat catalog, per-weapon kits and id/slot lookups.
 */

import { normalizeWeaponType } from "../weapons.js";
import { SKILL_KITS, SKILLS } from "./catalog/index.js";

/** Number of skill slots on the client hotbar. */
export const SKILL_SLOTS = 6;

/** Skill ids that are not real skills, resolved by the server as a plain attack. */
export const BASIC_ATTACK_ID = "normal";

/** Skill lists keyed by weapon type id. */
export const SKILLS_BY_WEAPON = SKILL_KITS;

/** id -> skill entry. Internal lookup table shared by the helper modules. */
export const SKILLS_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));

/** id -> slot index. Internal lookup table for {@link skillSlot}. */
const SLOT_INDEX_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill.slot]));

/**
 * Normalise a caller-supplied weapon id to a known kit id.
 * @param {*} weapon
 * @returns {string}
 */
export { normalizeWeaponType };

/**
 * All skills authored for a weapon, ordered by slot.
 * @param {string} weapon
 * @returns {Object[]}
 */
export function skillsForWeapon(weapon) {
  return SKILLS_BY_WEAPON[normalizeWeaponType(weapon)] || [];
}

/**
 * Look up a skill by id.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function skillById(id) {
  if (typeof id !== "string") return undefined;
  return SKILLS_BY_ID.get(id);
}

/**
 * Skill assigned to a slot of a weapon's kit, if any.
 * @param {string} weapon
 * @param {number} slot
 * @returns {Object|undefined}
 */
export function skillForSlot(weapon, slot) {
  return skillsForWeapon(weapon).find((skill) => skill.slot === slot);
}

/**
 * Slot index for a skill id, or -1 when unknown.
 * @param {string} skill
 * @returns {number}
 */
export function skillSlot(skill) {
  return SLOT_INDEX_BY_ID.has(skill) ? SLOT_INDEX_BY_ID.get(skill) : -1;
}
