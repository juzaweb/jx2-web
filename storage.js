const STORAGE_KEY = "giang_ho_game_save_v1";

export class StorageManager {
  /**
   * Save game state to localStorage
   * @param {Object} data
   * @param {Object} data.stats Player stats (level, hp, mp, exp, coins, kills)
   * @param {{ x: number, y: number }} [data.position] Player coordinates
   * @param {boolean} [data.questRewarded] Quest completion state
   * @param {boolean} [data.audioEnabled] Sound setting
   * @returns {boolean} Success status
   */
  static save(data) {
    try {
      const payload = {
        stats: data.stats,
        position: data.position,
        questRewarded: !!data.questRewarded,
        audioEnabled: data.audioEnabled,
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
