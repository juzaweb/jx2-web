/**
 * Giang Ho API Client
 * Connects frontend game client to the Node.js backend API service.
 */

const DEFAULT_API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:5000/api";

export class ApiClient {
  constructor(baseUrl = DEFAULT_API_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if backend service is available
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return false;
      const data = await res.json();
      return data.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Load saved player data from backend
   * @param {string} playerId
   * @returns {Promise<Object|null>}
   */
  async loadSave(playerId) {
    const res = await fetch(`${this.baseUrl}/save/${encodeURIComponent(playerId)}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to load save: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  /**
   * Save player progress to backend
   * @param {string} playerId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async saveProgress(playerId, data) {
    const res = await fetch(`${this.baseUrl}/save/${encodeURIComponent(playerId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to save progress: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  /**
   * Fetch current leaderboard
   * @param {"level"|"kills"|"coins"|"exp"} [sortBy="level"]
   * @param {number} [limit=10]
   * @returns {Promise<Object>}
   */
  async getLeaderboard(sortBy = "level", limit = 10) {
    const params = new URLSearchParams({ sortBy, limit: String(limit) });
    const res = await fetch(`${this.baseUrl}/leaderboard?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch leaderboard: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  /**
   * Submit score directly to leaderboard
   * @param {Object} entry
   * @returns {Promise<Object>}
   */
  async submitScore(entry) {
    const res = await fetch(`${this.baseUrl}/leaderboard/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      throw new Error(`Failed to submit score: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  /**
   * Get player inventory
   * @param {string} playerId
   * @returns {Promise<Record<string, number>>}
   */
  async getInventory(playerId) {
    const res = await fetch(`${this.baseUrl}/inventory/${encodeURIComponent(playerId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch inventory: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data.inventory;
  }

  /**
   * Update player inventory
   * @param {string} playerId
   * @param {Record<string, number>} inventory
   * @returns {Promise<Record<string, number>>}
   */
  async updateInventory(playerId, inventory) {
    const res = await fetch(`${this.baseUrl}/inventory/${encodeURIComponent(playerId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventory }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update inventory: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data.inventory;
  }
}

export const apiClient = new ApiClient();
