/**
 * Per-character skill bindings for the mobile arc buttons.
 *
 * The mobile cluster has {@link MOBILE_SKILL_SLOTS} buttons and starts empty: a
 * player taps a "+" button, picks a sect skill, and that button casts it. The
 * bindings are stored as an array of skill ids (null = empty button).
 */

const STORAGE_PREFIX = "jx2_mobile_skills_";

export const MOBILE_SKILL_SLOTS = 4;

/** Empty bindings: every arc button starts as an unassigned "+". */
export const DEFAULT_MOBILE_SKILLS = Object.freeze(
  Array.from({ length: MOBILE_SKILL_SLOTS }, () => null)
);

const storageKey = (characterId) => `${STORAGE_PREFIX}${characterId || "guest"}`;

/**
 * Coerce raw storage into a fixed-length array of skill ids.
 * @param {unknown} raw
 * @returns {(string|null)[]}
 */
export function sanitizeMobileSkills(raw) {
  const result = Array.from({ length: MOBILE_SKILL_SLOTS }, () => null);
  if (!Array.isArray(raw)) return result;

  for (let index = 0; index < MOBILE_SKILL_SLOTS; index++) {
    const value = raw[index];
    if (typeof value === "string" && value.trim().length > 0) {
      result[index] = value.trim();
    }
  }
  return result;
}

/**
 * Load a character's mobile skill bindings.
 * @param {string} [characterId]
 * @returns {(string|null)[]}
 */
export function loadMobileSkills(characterId) {
  try {
    const raw = localStorage.getItem(storageKey(characterId));
    if (!raw) return [...DEFAULT_MOBILE_SKILLS];
    return sanitizeMobileSkills(JSON.parse(raw));
  } catch {
    return [...DEFAULT_MOBILE_SKILLS];
  }
}

/**
 * Persist a character's mobile skill bindings.
 * @param {string} [characterId]
 * @param {unknown} skills
 * @returns {(string|null)[]}
 */
export function saveMobileSkills(characterId, skills) {
  const sanitized = sanitizeMobileSkills(skills);
  try {
    localStorage.setItem(storageKey(characterId), JSON.stringify(sanitized));
  } catch {
    // Ignore storage failures; the in-memory session still works.
  }
  return sanitized;
}

/**
 * Assign (or clear) the skill bound to one arc button.
 * @param {string} [characterId]
 * @param {unknown} current
 * @param {number} index 0-based button index
 * @param {string|null} skillId null clears the button
 * @returns {(string|null)[]}
 */
export function assignMobileSkill(characterId, current, index, skillId) {
  const sanitized = sanitizeMobileSkills(current);
  if (!Number.isInteger(index) || index < 0 || index >= MOBILE_SKILL_SLOTS) {
    return sanitized;
  }
  sanitized[index] =
    typeof skillId === "string" && skillId.trim().length > 0 ? skillId.trim() : null;
  return saveMobileSkills(characterId, sanitized);
}
