/**
 * Giang Ho API Client
 * Connects frontend game client to the Node.js backend API service.
 */

const getApiBase = () => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  if (typeof window !== "undefined") {
    return "/api";
  }
  return "http://localhost:5000/api";
};

const DEFAULT_API_BASE = getApiBase();

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

  /**
   * Helper to safely parse JSON response
   * @private
   */
  async _parseJson(res) {
    try {
      return await res.json();
    } catch {
      throw new Error(`Máy chủ phản hồi không đúng định dạng (HTTP ${res.status})`);
    }
  }

  /**
   * Check if a username is available for registration
   * @param {string} username
   * @returns {Promise<{ available: boolean, reason: string }>}
   */
  async checkUsername(username) {
    const res = await fetch(
      `${this.baseUrl}/users/check-username?username=${encodeURIComponent(username)}`
    );
    const json = await this._parseJson(res);
    if (!res.ok) {
      throw new Error(json?.error || `Kiểm tra tài khoản thất bại (HTTP ${res.status})`);
    }
    return json.data;
  }

  /**
   * Fetch the authoritative user profile from the backend
   * @param {string} userId
   * @returns {Promise<Object>} User profile (id, username, displayName, ...)
   */
  async getProfile(userId) {
    const res = await fetch(`${this.baseUrl}/users/me?userId=${encodeURIComponent(userId)}`);
    const json = await this._parseJson(res);
    if (!res.ok) {
      const error = new Error(json?.error || `Không tải được thông tin tài khoản (HTTP ${res.status})`);
      error.status = res.status;
      throw error;
    }
    return json.data.user;
  }

  /**
   * Register a new user
   * @param {string} username
   * @param {string} password
   * @param {string} [displayName]
   * @returns {Promise<{ user: Object, token: string }>}
   */
  async register(username, password, displayName = "") {
    const res = await fetch(`${this.baseUrl}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName }),
    });
    const json = await this._parseJson(res);
    if (!res.ok) {
      throw new Error(json?.error || `Đăng ký thất bại với mã HTTP ${res.status}`);
    }
    return json.data;
  }

  /**
   * Authenticate user credentials
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ user: Object, token: string }>}
   */
  async login(username, password) {
    const res = await fetch(`${this.baseUrl}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const json = await this._parseJson(res);
    if (!res.ok) {
      throw new Error(json?.error || `Đăng nhập thất bại với mã HTTP ${res.status}`);
    }
    return json.data;
  }
}

export const apiClient = new ApiClient();
