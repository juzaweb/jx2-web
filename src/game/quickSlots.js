/**
 * Per-character quick slot assignments for hotbar slots 1 through 9.
 *
 * A slot holds one binding string: either an item id (`kim-sang-duoc`) or a
 * skill binding tagged with {@link SKILL_BINDING_PREFIX} (`skill:dai_tu_di_chuong`).
 * Default is empty for all 9 slots.
 */

const STORAGE_PREFIX = "jx2_quick_slots_";

export const QUICK_SLOT_COUNT = 9;

/** Prefix that marks a hotbar binding as a weapon skill instead of an item id. */
export const SKILL_BINDING_PREFIX = "skill:";

/**
 * Whether a hotbar binding points at a skill.
 * @param {unknown} binding
 * @returns {boolean}
 */
export function isSkillBinding(binding) {
  return typeof binding === "string" && binding.startsWith(SKILL_BINDING_PREFIX);
}

/**
 * Encode a skill id as a hotbar binding.
 * @param {string} skillId
 * @returns {string}
 */
export function skillBinding(skillId) {
  return `${SKILL_BINDING_PREFIX}${skillId}`;
}

/**
 * The skill id inside a hotbar binding, or null for item bindings.
 * @param {unknown} binding
 * @returns {string|null}
 */
export function skillIdFromBinding(binding) {
  return isSkillBinding(binding) ? binding.slice(SKILL_BINDING_PREFIX.length) : null;
}

export const DEFAULT_QUICK_SLOTS = Object.freeze({
  1: null,
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
  7: null,
  8: null,
  9: null
});

const storageKey = (characterId) => `${STORAGE_PREFIX}${characterId || "guest"}`;

/**
 * Sanitize a quick slot mapping object into an object with numeric keys 1..9 mapping to string item IDs or null.
 * @param {Object} raw
 * @returns {Record<number, string|null>}
 */
export function sanitizeQuickSlots(raw) {
  const result = { ...DEFAULT_QUICK_SLOTS };
  if (!raw || typeof raw !== "object") return result;

  for (let i = 1; i <= QUICK_SLOT_COUNT; i++) {
    const val = raw[i] ?? raw[String(i)];
    if (typeof val === "string" && val.trim().length > 0) {
      result[i] = val.trim();
    } else {
      result[i] = null;
    }
  }

  return result;
}

/**
 * Load a character's quick slot assignments from localStorage. Default is empty for all 9 slots.
 * @param {string} [characterId]
 * @returns {Record<number, string|null>}
 */
export function loadQuickSlots(characterId) {
  try {
    const raw = localStorage.getItem(storageKey(characterId));
    if (!raw) return { ...DEFAULT_QUICK_SLOTS };
    const parsed = JSON.parse(raw);
    return sanitizeQuickSlots(parsed);
  } catch {
    return { ...DEFAULT_QUICK_SLOTS };
  }
}

/**
 * Persist a character's quick slot assignments to localStorage.
 * @param {string} [characterId]
 * @param {Object} quickSlots
 * @returns {Record<number, string|null>}
 */
export function saveQuickSlots(characterId, quickSlots) {
  const sanitized = sanitizeQuickSlots(quickSlots);
  try {
    localStorage.setItem(storageKey(characterId), JSON.stringify(sanitized));
  } catch {
    // Ignore storage failures
  }
  return sanitized;
}

/**
 * Assign an item to a specific quick slot (1..9).
 * @param {string} [characterId]
 * @param {Object} currentSlots
 * @param {number} slot
 * @param {string|null} itemId
 * @returns {Record<number, string|null>}
 */
export function assignQuickSlot(characterId, currentSlots, slot, itemId) {
  if (typeof slot !== "number" || slot < 1 || slot > QUICK_SLOT_COUNT) {
    return sanitizeQuickSlots(currentSlots);
  }
  const next = { ...sanitizeQuickSlots(currentSlots), [slot]: itemId ? String(itemId) : null };
  return saveQuickSlots(characterId, next);
}

/**
 * Unassign/clear a specific quick slot (1..9).
 * @param {string} [characterId]
 * @param {Object} currentSlots
 * @param {number} slot
 * @returns {Record<number, string|null>}
 */
export function clearQuickSlot(characterId, currentSlots, slot) {
  return assignQuickSlot(characterId, currentSlots, slot, null);
}

/**
 * Move or swap quick slots from `fromSlot` to `toSlot`.
 * @param {string} [characterId]
 * @param {Object} currentSlots
 * @param {number} fromSlot
 * @param {number} toSlot
 * @returns {Record<number, string|null>}
 */
export function moveQuickSlot(characterId, currentSlots, fromSlot, toSlot) {
  if (
    typeof fromSlot !== "number" ||
    typeof toSlot !== "number" ||
    fromSlot < 1 ||
    fromSlot > QUICK_SLOT_COUNT ||
    toSlot < 1 ||
    toSlot > QUICK_SLOT_COUNT
  ) {
    return sanitizeQuickSlots(currentSlots);
  }

  const sanitized = sanitizeQuickSlots(currentSlots);
  const temp = sanitized[toSlot];
  sanitized[toSlot] = sanitized[fromSlot];
  sanitized[fromSlot] = temp;

  return saveQuickSlots(characterId, sanitized);
}
