/**
 * Skill registry: the flat catalog, per-sect kits and id/slot lookups.
 */

import { normalizeWeaponType } from "../weapons.js";
import { SKILL_KITS, SKILLS } from "./catalog/index.js";

/** Number of skill slots on the client hotbar. */
export const SKILL_SLOTS = 6;

/** Skill ids that are not real skills, resolved by the server as a plain attack. */
export const BASIC_ATTACK_ID = "normal";

/** Skill lists keyed by sect id. */
export const SKILLS_BY_SECT = SKILL_KITS;

/** Legacy or misnamed skill id aliases mapped to canonical ids. */
export const LEGACY_SKILL_ID_ALIASES = Object.freeze({
  thai_cuc_quyen: "thai_cuc_kiem_phap"
});

/** id -> skill entry. Internal lookup table shared by the helper modules. */
export const SKILLS_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));
for (const [legacyId, canonicalId] of Object.entries(LEGACY_SKILL_ID_ALIASES)) {
  const target = SKILLS_BY_ID.get(canonicalId);
  if (target) SKILLS_BY_ID.set(legacyId, target);
}

/** id -> slot index. Internal lookup table for {@link skillSlot}. */
const SLOT_INDEX_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill.slot]));
for (const [legacyId, canonicalId] of Object.entries(LEGACY_SKILL_ID_ALIASES)) {
  const slot = SLOT_INDEX_BY_ID.get(canonicalId);
  if (typeof slot === "number") SLOT_INDEX_BY_ID.set(legacyId, slot);
}

/**
 * Normalise a caller-supplied weapon id to a known weapon type.
 * @param {*} weapon
 * @returns {string}
 */
export { normalizeWeaponType };

/**
 * All skills authored for a sect, ordered by slot. An unknown sect yields an
 * empty list rather than silently borrowing another sect's kit; callers that
 * hold a raw stored value normalise it with `normalizeSect` first.
 * @param {string} sect
 * @returns {Object[]}
 */
export function skillsForSect(sect) {
  if (typeof sect !== "string") return [];
  return SKILLS_BY_SECT[sect] || [];
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
 * Skill assigned to a slot of a sect's kit, if any.
 * @param {string} sect
 * @param {number} slot
 * @returns {Object|undefined}
 */
export function skillForSlot(sect, slot) {
  return skillsForSect(sect).find((skill) => skill.slot === slot);
}

/**
 * Slot index for a skill id, or -1 when unknown.
 * @param {string} skill
 * @returns {number}
 */
export function skillSlot(skill) {
  return SLOT_INDEX_BY_ID.has(skill) ? SLOT_INDEX_BY_ID.get(skill) : -1;
}
