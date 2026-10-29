/**
 * Martial sects (môn phái).
 *
 * A sect owns a skill kit and the weapon that kit is built around: a hero may
 * only cast the arts of the sect they joined, and only while wielding that
 * weapon. Factions (see `factions.js`) stay a separate, political concept: they
 * decide the home city and PvP hostility, never the skill kit.
 */

/**
 * Playable sects, in catalog order. The id is also the `characters.sect` value
 * and the `SKILL_KITS` key.
 * @type {ReadonlyArray<string>}
 */
export const SECT_IDS = Object.freeze(["thieu-lam", "vo-dang", "nga-my", "ngu-doc"]);

/**
 * Sect catalog. `starterSkillId` is the art every hero of that sect knows from
 * the moment the character is created; `weaponItemId` is the starting weapon the
 * server grants and equips.
 */
export const SECTS = Object.freeze({
  "thieu-lam": Object.freeze({
    id: "thieu-lam",
    nameKey: "sects.thieuLam.name",
    descKey: "sects.thieuLam.desc",
    glyph: "少",
    color: "#e0a63a",
    weapon: "bao-tay",
    starterSkillId: "thieu_lam_tam_phap",
    weaponItemId: "bao-tay-lang-khach"
  }),
  "vo-dang": Object.freeze({
    id: "vo-dang",
    nameKey: "sects.voDang.name",
    descKey: "sects.voDang.desc",
    glyph: "武",
    color: "#7fb3e0",
    weapon: "kiem",
    starterSkillId: "thieu_duong_kiem_phap",
    weaponItemId: "kiem-lang-khach"
  }),
  "nga-my": Object.freeze({
    id: "nga-my",
    nameKey: "sects.ngaMy.name",
    descKey: "sects.ngaMy.desc",
    glyph: "峨",
    color: "#d98fb0",
    weapon: "kiem",
    starterSkillId: "nga_my_kiem_phap",
    weaponItemId: "kiem-lang-khach"
  }),
  "ngu-doc": Object.freeze({
    id: "ngu-doc",
    nameKey: "sects.nguDoc.name",
    descKey: "sects.nguDoc.desc",
    glyph: "毒",
    color: "#8fbf5a",
    weapon: "dao",
    starterSkillId: "ngu_doc_tam_phap",
    weaponItemId: "dao-lang-khach"
  })
});

/** Sect a character joins when none was chosen (or the stored value is stale). */
export const DEFAULT_SECT = "vo-dang";

/** Value older databases carry in `characters.sect`. */
export const LEGACY_SECT = "none";

/**
 * Whether a value is a known sect id.
 * @param {*} id
 * @returns {boolean}
 */
export function isSectId(id) {
  return typeof id === "string" && SECT_IDS.includes(id);
}

/**
 * Normalise a stored sect id: unknown and legacy values fall back to the default.
 * @param {*} id
 * @returns {string}
 */
export function normalizeSect(id) {
  return isSectId(id) ? id : DEFAULT_SECT;
}

/**
 * Weapon type a sect's kit is built around.
 * @param {*} sect
 * @returns {string}
 */
export function sectWeapon(sect) {
  return SECTS[normalizeSect(sect)].weapon;
}

/**
 * The art every hero of a sect knows from creation.
 * @param {*} sect
 * @returns {string}
 */
export function sectStarterSkillId(sect) {
  return SECTS[normalizeSect(sect)].starterSkillId;
}

/**
 * Starting weapon item id for a sect.
 * @param {*} sect
 * @returns {string}
 */
export function sectWeaponItemId(sect) {
  return SECTS[normalizeSect(sect)].weaponItemId;
}

/**
 * Sect that owns a skill id, or null when the id belongs to no kit.
 * @param {string} skillId
 * @param {Record<string, ReadonlyArray<{id: string}>>} kits
 * @returns {string|null}
 */
export function sectForSkill(skillId, kits = {}) {
  if (typeof skillId !== "string") return null;
  for (const [sect, entries] of Object.entries(kits)) {
    if (Array.isArray(entries) && entries.some((entry) => entry?.id === skillId)) return sect;
  }
  return null;
}
