const STORAGE_KEY = "giang_ho_game_save_v1";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Coerce an arbitrary value into a safe id -> non-negative integer map.
 * @param {*} value
 * @returns {Record<string, number> | undefined}
 */
const sanitizeInventory = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out = {};
  Object.entries(value).forEach(([id, qty]) => {
    if (DANGEROUS_KEYS.has(id)) return;
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) return;
    out[id] = Math.floor(qty);
  });
  return out;
};

export class StorageManager {
  /**
   * Save game state to localStorage
   * @param {Object} data
   * @param {Object} data.stats Player stats (level, hp, mp, exp, coins, kills)
   * @param {{ x: number, y: number }} [data.position] Player coordinates
   * @param {boolean} [data.questRewarded] Quest completion state
   * @param {boolean} [data.audioEnabled] Sound setting
   * @param {Record<string, number>} [data.inventory] Stack quantities keyed by item id
   * @returns {boolean} Success status
   */
  static save(data) {
    try {
      // Preserve previously saved stack quantities when a caller (e.g. the game
      // loop) saves unrelated state without passing inventory.
      let inventory = data.inventory;
      if (inventory === undefined) {
        const previous = this.load();
        inventory = previous ? previous.inventory : undefined;
      }

      const payload = {
        stats: data.stats,
        position: data.position,
        questRewarded: !!data.questRewarded,
        audioEnabled: data.audioEnabled,
        inventory: sanitizeInventory(inventory),
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn("StorageManager: Failed to save game state:", error);
      return false;
    }
  }

  /**
   * Load saved game state from localStorage
   * @returns {Object|null} Saved game payload or null
   */
  static load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || !data.stats) {
        return null;
      }
      return data;
    } catch (error) {
      console.warn("StorageManager: Failed to parse saved game:", error);
      return null;
    }
  }

  /**
   * Load persisted stack quantities, merged over catalog defaults so that
   * newly added items keep their catalog quantity.
   * @param {Record<string, number>} [defaults]
   * @returns {Record<string, number>}
   */
  static loadInventory(defaults = {}) {
    const data = this.load();
    const saved = data && data.inventory ? data.inventory : {};
    return { ...defaults, ...saved };
  }

  /**
   * Remove saved game from localStorage
   * @returns {boolean}
   */
  static clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.warn("StorageManager: Failed to clear save data:", error);
      return false;
    }
  }

  /**
   * Check if a saved game exists
   * @returns {boolean}
   */
  static exists() {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  }
}
