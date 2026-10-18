import { sanitizeQuantities } from "./items.js";

const STORAGE_KEY = "giang_ho_game_save_v1";

/**
 * Coerce an arbitrary value into a safe id -> non-negative integer map, or
 * undefined when it is not a plain object (so "no inventory" and "empty
 * inventory" stay distinct). Shared with the server inventory sync.
 * @param {*} value
 * @returns {Record<string, number> | undefined}
 */
const sanitizeInventory = (value) => sanitizeQuantities(value) ?? undefined;

export class StorageManager {
  static activeUserId = null;

  /**
   * Set active user ID to isolate saved progress per user
   * @param {string|null} id
   */
  static setUserId(id) {
    this.activeUserId = id || null;
  }

  /**
   * Get the active storage key
   * @returns {string}
   */
  static getKey() {
    return this.activeUserId ? `${STORAGE_KEY}_${this.activeUserId}` : STORAGE_KEY;
  }

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
      localStorage.setItem(this.getKey(), JSON.stringify(payload));
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
      const raw = localStorage.getItem(this.getKey());
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
      localStorage.removeItem(this.getKey());
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
      return !!localStorage.getItem(this.getKey());
    } catch {
      return false;
    }
  }
}
