/**
 * Skill catalog shared by the client and the server.
 *
 * Every skill is data: MP cost, cooldown, range/radius and damage multiplier are
 * authoritative and therefore consumed by the server when it validates a cast and
 * computes the resulting damage. The client reads the same table to predict the
 * cost, gate the hotbar and render its VFX.
 *
 * A skill's `effects` are applied on a successful hit (or on self when
 * `target === "self"`). Only the effect kinds used by shipped skills are listed
 * here; unknown kinds are ignored, so the catalog can grow without breaking old
 * readers.
 */

/** Number of skill slots on the client hotbar. */
export const SKILL_SLOTS = 6;

/** Skill ids that are not real skills, resolved by the server as a plain attack. */
export const BASIC_ATTACK_ID = "normal";

/**
 * Thiếu Lâm kit is being rebuilt as a palm-technique (chưởng pháp) kit. The old
 * Thiếu Lâm Võ Tông (TLQ) fist/kick skills and icons were removed; the sect
 * resolves to an empty list until the new kit lands.
 */
const THIEU_LAM_SKILLS = [];

const VO_DANG_SKILLS = [];
const NGA_MY_SKILLS = [];
const NGU_DOC_SKILLS = [];

/** All authored skills, in catalog order. */
export const SKILLS = [...THIEU_LAM_SKILLS, ...VO_DANG_SKILLS, ...NGA_MY_SKILLS, ...NGU_DOC_SKILLS];

/** Skill lists keyed by sect id. */
export const SKILLS_BY_SECT = {
  "thieu-lam": THIEU_LAM_SKILLS,
  "vo-dang": VO_DANG_SKILLS,
  "nga-my": NGA_MY_SKILLS,
  "ngu-doc": NGU_DOC_SKILLS
};

const SKILLS_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));
const SLOT_INDEX_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill.slot]));

/**
 * Normalise a caller-supplied sect to a known id.
 * @param {*} sect
 * @returns {string}
 */
export const normalizeSect = (sect) =>
  Object.prototype.hasOwnProperty.call(SKILLS_BY_SECT, sect) ? sect : "thieu-lam";

/**
 * All skills authored for a sect, ordered by slot.
 * @param {string} sect
 * @returns {Object[]}
 */
export function skillsForSect(sect) {
  return SKILLS_BY_SECT[normalizeSect(sect)] || [];
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
 * Skill assigned to a hotbar slot for a sect, if any.
 * @param {string} sect
 * @param {number} slot
 * @returns {Object|undefined}
 */
export function skillForSlot(sect, slot) {
  return skillsForSect(sect).find((skill) => skill.slot === slot);
}

/**
 * MP cost of a skill id. Unknown ids are free, which keeps `normal` and legacy
 * ids from ever charging mana.
 * @param {string} skill
 * @returns {number}
 */
export function skillMpCost(skill) {
  const entry = SKILLS_BY_ID.get(skill);
  return entry ? entry.mp : 0;
}

/**
 * Cooldown (ms) of a skill id.
 * @param {string} skill
 * @returns {number}
 */
export function skillCooldown(skill) {
  const entry = SKILLS_BY_ID.get(skill);
  return entry ? entry.cooldown : 0;
}

/**
 * Whether a skill is available at the given level.
 * @param {Object|string} skill
 * @param {number} level
 * @returns {boolean}
 */
export function skillUnlocked(skill, level) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return false;
  const normalized = Number.isFinite(level) ? Math.floor(level) : 1;
  return normalized >= entry.unlockLevel;
}

/**
 * Slot index for a skill id, or -1 when unknown.
 * @param {string} skill
 * @returns {number}
 */
export function skillSlot(skill) {
  return SLOT_INDEX_BY_ID.has(skill) ? SLOT_INDEX_BY_ID.get(skill) : -1;
}
