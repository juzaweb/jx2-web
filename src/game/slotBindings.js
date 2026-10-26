/**
 * Per-character slot bindings persisted in localStorage.
 *
 * The mobile skill fan and the mobile consumable buttons share the exact same
 * mechanics — a fixed-length array of ids where null means "empty button" — so
 * the storage and sanitising rules live here once rather than in two nearly
 * identical modules.
 *
 * @param {{ slotCount: number, storagePrefix: string }} options
 */
export function createSlotBindings({ slotCount, storagePrefix }) {
  const DEFAULT = Object.freeze(Array.from({ length: slotCount }, () => null));
  const storageKey = (characterId) => `${storagePrefix}${characterId || "guest"}`;

  /**
   * Coerce raw storage into a fixed-length array of ids.
   * @param {unknown} raw
   * @returns {(string|null)[]}
   */
  const sanitize = (raw) => {
    const result = Array.from({ length: slotCount }, () => null);
    if (!Array.isArray(raw)) return result;

    for (let index = 0; index < slotCount; index++) {
      const value = raw[index];
      if (typeof value === "string" && value.trim().length > 0) {
        result[index] = value.trim();
      }
    }
    return result;
  };

  /**
   * @param {string} [characterId]
   * @returns {(string|null)[]}
   */
  const load = (characterId) => {
    try {
      const raw = localStorage.getItem(storageKey(characterId));
      if (!raw) return [...DEFAULT];
      return sanitize(JSON.parse(raw));
    } catch {
      return [...DEFAULT];
    }
  };

  /**
   * @param {string} [characterId]
   * @param {unknown} values
   * @returns {(string|null)[]}
   */
  const save = (characterId, values) => {
    const sanitized = sanitize(values);
    try {
      localStorage.setItem(storageKey(characterId), JSON.stringify(sanitized));
    } catch {
      // Ignore storage failures; the in-memory session still works.
    }
    return sanitized;
  };

  /**
   * Bind (or clear with null) one slot and persist the result.
   * @param {string} [characterId]
   * @param {unknown} current
   * @param {number} index 0-based slot index
   * @param {string|null} value null clears the slot
   * @returns {(string|null)[]}
   */
  const assign = (characterId, current, index, value) => {
    const sanitized = sanitize(current);
    if (!Number.isInteger(index) || index < 0 || index >= slotCount) {
      return sanitized;
    }
    sanitized[index] =
      typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    return save(characterId, sanitized);
  };

  return { slotCount, DEFAULT, sanitize, load, save, assign };
}
