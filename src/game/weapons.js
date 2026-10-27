/**
 * Weapon types: the single source of truth for which skill kit a hero may use.
 *
 * A hero's usable skills are the ones whose `weapon` matches the weapon worn in
 * the `weapon` equipment slot. There are no sects any more.
 *
 * Kept framework-agnostic (no Phaser, no React) so the catalog, the equipment
 * model, the combat layer and the server can all share it.
 */

/** Every known weapon type id, in catalog order. */
export const WEAPON_TYPES = ["kiem", "bao-tay", "dao"];

/** Weapon a brand-new hero starts with. */
export const DEFAULT_WEAPON = "kiem";

/** i18n keys for the weapon names shown in the skill panel. */
export const WEAPON_LABEL_KEYS = Object.freeze({
  kiem: "weapons.kiem",
  "bao-tay": "weapons.baoTay",
  dao: "weapons.dao"
});

/**
 * Normalise a caller-supplied weapon id.
 * @param {*} weapon
 * @param {string} [fallback=DEFAULT_WEAPON]
 * @returns {string}
 */
export function normalizeWeaponType(weapon, fallback = DEFAULT_WEAPON) {
  return WEAPON_TYPES.includes(weapon) ? weapon : fallback;
}

/**
 * The weapon type an item provides, or null when it is not a weapon.
 * @param {{ weaponType?: string }|null|undefined} item
 * @returns {string|null}
 */
export function weaponTypeOfItem(item) {
  if (!item || typeof item !== "object") return null;
  return WEAPON_TYPES.includes(item.weaponType) ? item.weaponType : null;
}
