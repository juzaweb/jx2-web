/**
 * Character gender: the single source of truth for the gender values used by the
 * rig, the HUD and the network layer. Kept framework-agnostic so both the game
 * modules and the React UI can share it.
 *
 * The server persists these same values ("male" | "female"); anything unknown
 * falls back to “male”.
 */

export const GENDERS = ["male", "female"];

export const DEFAULT_GENDER = "male";

/**
 * Normalise a caller-supplied gender to a known value.
 * @param {*} gender
 * @returns {"male"|"female"}
 */
export const normalizeGender = (gender) => (GENDERS.includes(gender) ? gender : DEFAULT_GENDER);
