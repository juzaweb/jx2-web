/**
 * Giang Ho API Client
 * Connects frontend game client to the Node.js backend API service.
 */

import { readSession } from "./session.js";

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
   * One-time import of a legacy local save (bag + worn gear) for a character.
   * The server refuses to run it twice, so calling it on every login is safe.
   * @param {string} characterId
   * @param {Record<string, number>} inventory
   * @param {Record<string, string|null>} equipment
   * @param {string} [token]
   * @returns {Promise<{ characterId: string, inventory: Object, equipment: Object }>}
   */
  async importState(characterId, inventory, equipment, token) {
    const res = await fetch(`${this.baseUrl}/state/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this._getAuthHeaders(token)
      },
      body: JSON.stringify({ characterId, inventory, equipment })
    });
    const json = await this._parseJson(res);
    if (!res.ok) {
      const error = new Error(json?.error || `Không nhập được dữ liệu cũ (HTTP ${res.status})`);
      error.status = res.status;
      throw error;
    }
    return json.data;
  }

  /**
   * Helper to safely parse JSON response
   * @private
   */
  async _parseJson(res) {
    try {
      return await res.json();
    } catch {
      const err = new Error(`Máy chủ phản hồi không đúng định dạng (HTTP ${res.status})`);
      err.status = res.status;
      throw err;
    }
  }

  /**
   * Helper to resolve session authorization header.
   * Prefers explicitly passed token, falling back to cached session token.
   * @private
   * @param {string} [token]
   * @returns {Record<string, string>}
   */
  _getAuthHeaders(token) {
    const activeToken =
      token || (typeof window !== "undefined" ? readSession()?.token : null);
    return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
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
   * @param {string} [token]
   * @returns {Promise<Object>} User profile (id, username, displayName, ...)
   */
  async getProfile(userId, token) {
    const res = await fetch(`${this.baseUrl}/users/me?userId=${encodeURIComponent(userId)}`, {
      headers: { ...this._getAuthHeaders(token) }
    });
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

  /**
   * List the characters owned by a user account
   * @param {string} userId
   * @param {string} [token]
   * @returns {Promise<{ characters: Object[], maxSlots: number }>}
   */
  async listCharacters(userId, token) {
    const res = await fetch(`${this.baseUrl}/users/${encodeURIComponent(userId)}/characters`, {
      headers: { ...this._getAuthHeaders(token) }
    });
    const json = await this._parseJson(res);
    if (!res.ok) {
      const error = new Error(json?.error || `Không tải được danh sách nhân vật (HTTP ${res.status})`);
      error.status = res.status;
      throw error;
    }
    return json.data;
  }

  /**
   * Create a new character for a user account
   * @param {string} userId
   * @param {string} name
   * @param {"male"|"female"} [gender="male"]
   * @param {string} [token]
   * @returns {Promise<Object>} The created character
   */
  async createCharacter(userId, name, gender = "male", token) {
    const res = await fetch(`${this.baseUrl}/users/${encodeURIComponent(userId)}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this._getAuthHeaders(token)
      },
      body: JSON.stringify({ name, gender }),
    });
    const json = await this._parseJson(res);
    if (!res.ok) {
      const error = new Error(json?.error || `Tạo nhân vật thất bại (HTTP ${res.status})`);
      error.status = res.status;
      throw error;
    }
    return json.data;
  }

  /**
   * Permanently delete a character
   * @param {string} userId
   * @param {string} characterId
   * @param {string} [token]
   * @returns {Promise<{ characters: Object[] }>}
   */
  async deleteCharacter(userId, characterId, token) {
    const res = await fetch(
      `${this.baseUrl}/users/${encodeURIComponent(userId)}/characters/${encodeURIComponent(characterId)}`,
      {
        method: "DELETE",
        headers: { ...this._getAuthHeaders(token) }
      }
    );
    const json = await this._parseJson(res);
    if (!res.ok) {
      const error = new Error(json?.error || `Xoá nhân vật thất bại (HTTP ${res.status})`);
      error.status = res.status;
      throw error;
    }
    return json.data;
  }
}

export const apiClient = new ApiClient();
