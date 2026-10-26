import { sanitizeQuantities } from "./items.js";
import { sanitizeEquipment, defaultEquipment } from "./equipment.js";

const STORAGE_KEY = "giang_ho_game_save_v1";
const INVENTORY_KEY = "giang_ho_inventory_v2";
const EQUIPMENT_KEY = "giang_ho_equipment_v1";

/**
 * Bags persisted before v2 were seeded with a hard-coded demo catalog. The prefix
 * (not the full key) is matched so every account/character scoped copy is purged.
 */
const LEGACY_INVENTORY_KEY_PREFIX = "giang_ho_inventory_v1";

/**
 * Coerce an arbitrary value into a safe id -> non-negative integer map, or `{}`
 * when it is not a plain object. Shared with the server inventory sync.
 * @param {*} value
 * @returns {Record<string, number>}
 */
const sanitizeInventory = (value) => sanitizeQuantities(value) || {};

export class StorageManager {
  static activeUserId = null;
  static activeCharacterId = null;

  /**
   * Set active user ID to isolate account-scoped progress (stats, position).
   * @param {string|null} id
   */
  static setUserId(id) {
    this.activeUserId = id || null;
  }

  /**
   * Set the active character ID. The bag is character-scoped, so each hero keeps
   * its own local inventory instead of sharing one account-wide bag.
   * @param {string|null} id
   */
  static setCharacterId(id) {
    this.activeCharacterId = id || null;
  }

  /**
   * Get the active account-scoped storage key.
   * @returns {string}
   */
  static getKey() {
    return this.activeUserId ? `${STORAGE_KEY}_${this.activeUserId}` : STORAGE_KEY;
  }

  /**
   * Get the active inventory storage key. Prefers the character so bags never leak
   * between characters; falls back to the account (guests / no character chosen).
   * @returns {string}
   */
  static getInventoryKey() {
    if (this.activeCharacterId) return `${INVENTORY_KEY}_${this.activeCharacterId}`;
    return this.activeUserId ? `${INVENTORY_KEY}_${this.activeUserId}` : INVENTORY_KEY;
  }

  /**
   * Get the active equipment storage key, scoped the same way as the bag so
   * gear never leaks between characters.
   * @returns {string}
   */
  static getEquipmentKey() {
    if (this.activeCharacterId) return `${EQUIPMENT_KEY}_${this.activeCharacterId}`;
    return this.activeUserId ? `${EQUIPMENT_KEY}_${this.activeUserId}` : EQUIPMENT_KEY;
  }

  /**
   * Save local settings to localStorage. Gameplay state (stats, bag, gear,
   * quests) is server-owned and is deliberately not written here.
   * @param {Object} data
   * @param {string} [data.mapId] Map the saved position belongs to
   * @param {{ x: number, y: number }} [data.position] Player coordinates
   * @param {boolean} [data.audioEnabled] Sound setting
   * @param {boolean} [data.pkFlag] PK opt-in flag, restored on the next boot
   * @returns {boolean} Success status
   */
  static save(data) {
    try {
      const payload = {
        // Which map the saved position belongs to (see src/game/maps). Older
        // saves have no mapId and simply fall back to the default map.
        mapId: typeof data.mapId === "string" ? data.mapId : undefined,
        position: data.position,
        audioEnabled: data.audioEnabled,
        // The PK flag is a player choice, not session state: it has to survive a
        // reload or the HUD and the server disagree about who is flagged.
        pkFlag: data.pkFlag === true,
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
   * Load saved local settings from localStorage. Gameplay progress (stats, bag,
   * gear) is server-owned; only map/position/audio/PK are stored here.
   * @returns {Object|null} Saved payload or null
   */
  static load() {
    try {
      const raw = localStorage.getItem(this.getKey());
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return null;
      }
      return data;
    } catch (error) {
      console.warn("StorageManager: Failed to parse saved game:", error);
      return null;
    }
  }

  /**
   * One-off migration: drop bags saved before v2, so the removed demo stacks can
   * never be restored from an old local save. Idempotent and safe to call on every
   * boot, as it only touches keys under the legacy prefix.
   * @returns {number} How many stale keys were removed
   */
  static purgeLegacyInventory() {
    try {
      const stale = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith(LEGACY_INVENTORY_KEY_PREFIX)) stale.push(key);
      }
      stale.forEach((key) => localStorage.removeItem(key));
      return stale.length;
    } catch (error) {
      console.warn("StorageManager: Failed to purge legacy inventories:", error);
      return 0;
    }
  }

  /**
   * Load the active character's persisted bag. Nothing is merged in: a character
   * only owns the stacks saved under its own key. This is read-only: the bag is
   * written only by the server now, and this copy exists solely as the source for
   * the one-time legacy import (`POST /api/state/import`).
   * @returns {Record<string, number>}
   */
  static loadInventory() {
    try {
      const raw = localStorage.getItem(this.getInventoryKey());
      return raw ? sanitizeInventory(JSON.parse(raw)) : {};
    } catch (error) {
      console.warn("StorageManager: Failed to parse saved inventory:", error);
      return {};
    }
  }

  /**
   * Load the active character's persisted equipment, merged over empty defaults
   * so every slot is always present. Read-only for the same reason as
   * {@link StorageManager.loadInventory}.
   * @returns {Record<string, string|null>}
   */
  static loadEquipment() {
    try {
      const raw = localStorage.getItem(this.getEquipmentKey());
      return raw ? sanitizeEquipment(JSON.parse(raw)) : defaultEquipment();
    } catch (error) {
      console.warn("StorageManager: Failed to parse saved equipment:", error);
      return defaultEquipment();
    }
  }

  /**
   * Remove saved account progress from localStorage
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
   * Remove the active character's saved bag (used by the reset flow).
   * @returns {boolean}
   */
  static clearInventory() {
    try {
      localStorage.removeItem(this.getInventoryKey());
      return true;
    } catch (error) {
      console.warn("StorageManager: Failed to clear inventory:", error);
      return false;
    }
  }

  /**
   * Remove the active character's saved equipment (used by the reset flow).
   * @returns {boolean}
   */
  static clearEquipment() {
    try {
      localStorage.removeItem(this.getEquipmentKey());
      return true;
    } catch (error) {
      console.warn("StorageManager: Failed to clear equipment:", error);
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
