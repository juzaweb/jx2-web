import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_LEADERBOARD_ENTRIES = 500;

/**
 * Sanitize object keys to prevent prototype pollution
 */
export const sanitizeData = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const clean = {};
  for (const [k, v] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    clean[k] = typeof v === "object" && v !== null && !Array.isArray(v) ? sanitizeData(v) : v;
  }
  return clean;
};

const DEFAULT_LEADERBOARD = [
  { playerId: "hero_01", playerName: "Tiêu Phong", level: 50, kills: 280, coins: 99999, exp: 125000, updatedAt: 1700000000000 },
  { playerId: "hero_02", playerName: "Dương Quá", level: 45, kills: 210, coins: 75000, exp: 98000, updatedAt: 1700001000000 },
  { playerId: "hero_03", playerName: "Lệnh Hồ Xung", level: 40, kills: 185, coins: 54000, exp: 82000, updatedAt: 1700002000000 },
  { playerId: "hero_04", playerName: "Đoàn Dự", level: 35, kills: 120, coins: 42000, exp: 64000, updatedAt: 1700003000000 },
  { playerId: "hero_05", playerName: "Trương Vô Kỵ", level: 30, kills: 95, coins: 31000, exp: 49000, updatedAt: 1700004000000 }
];

export class DataStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = {
      saves: {},
      leaderboard: [...DEFAULT_LEADERBOARD]
    };
    this.isLoaded = false;
    this._initPromise = null;
    this._writeQueue = Promise.resolve();
  }

  async init() {
    if (this.isLoaded) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });

        const content = await fs.readFile(this.filePath, "utf-8");
        const parsed = JSON.parse(content);
        this.state = {
          saves: parsed.saves || {},
          leaderboard: Array.isArray(parsed.leaderboard) && parsed.leaderboard.length > 0
            ? parsed.leaderboard
            : [...DEFAULT_LEADERBOARD]
        };
      } catch {
        // File does not exist or invalid JSON; persist initial state
        await this._writeToDisk();
      }
      this.isLoaded = true;
    })();

    return this._initPromise;
  }

  /**
   * Queue safe atomic persistence to disk to prevent race conditions
   */
  async persist() {
    this._writeQueue = this._writeQueue.then(async () => {
      await this._writeToDisk();
    }).catch((err) => {
      console.error("[DataStore] Write queue error:", err);
    });
    return this._writeQueue;
  }

  async _writeToDisk() {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const tempFile = `${this.filePath}.${uniqueSuffix}.tmp`;
      const dataStr = JSON.stringify(this.state, null, 2);
      await fs.writeFile(tempFile, dataStr, "utf-8");
      await fs.rename(tempFile, this.filePath);
    } catch (err) {
      console.error("[DataStore] Failed to persist state to disk:", err);
      throw err;
    }
  }

  // --- Saves / Progress ---

  async getSave(playerId) {
    await this.init();
    return this.state.saves[playerId] || null;
  }

  async setSave(playerId, saveData) {
    await this.init();
    const cleanData = sanitizeData(saveData);
    const existing = this.state.saves[playerId] || {};

    const merged = {
      ...existing,
      ...cleanData,
      playerId,
      updatedAt: Date.now()
    };

    this.state.saves[playerId] = merged;

    // Automatically sync stats to leaderboard if stats are present
    if (merged.stats) {
      const level = Math.max(1, Math.floor(Number(merged.stats.level) || 1));
      const kills = Math.max(0, Math.floor(Number(merged.stats.kills) || 0));
      const coins = Math.max(0, Math.floor(Number(merged.stats.coins) || 0));
      const exp = Math.max(0, Math.floor(Number(merged.stats.exp) || 0));

      this._upsertLeaderboard({
        playerId,
        playerName: (typeof merged.playerName === "string" && merged.playerName.trim())
          ? merged.playerName.trim().slice(0, 50)
          : existing.playerName || `Thiếu Hiệp ${playerId.slice(0, 5)}`,
        level,
        kills,
        coins,
        exp,
        updatedAt: merged.updatedAt
      });
    }

    await this.persist();
    return merged;
  }

  async deleteSave(playerId) {
    await this.init();
    if (this.state.saves[playerId]) {
      delete this.state.saves[playerId];
      // remove from leaderboard as well
      this.state.leaderboard = this.state.leaderboard.filter(e => e.playerId !== playerId);
      await this.persist();
      return true;
    }
    return false;
  }

  // --- Inventory ---

  async getInventory(playerId) {
    await this.init();
    const save = this.state.saves[playerId];
    return save && save.inventory ? save.inventory : {};
  }

  async setInventory(playerId, inventory) {
    await this.init();
    const cleanInventory = sanitizeData(inventory);
    if (!this.state.saves[playerId]) {
      this.state.saves[playerId] = {
        playerId,
        stats: { level: 1, hp: 100, mp: 80, exp: 0, coins: 0, kills: 0 },
        inventory: cleanInventory,
        updatedAt: Date.now()
      };
    } else {
      this.state.saves[playerId].inventory = cleanInventory;
      this.state.saves[playerId].updatedAt = Date.now();
    }
    await this.persist();
    return this.state.saves[playerId].inventory;
  }

  // --- Leaderboard ---

  _upsertLeaderboard(entry) {
    const clean = sanitizeData(entry);
    if (!clean.playerId) return;

    const index = this.state.leaderboard.findIndex(e => e.playerId === clean.playerId);
    if (index >= 0) {
      this.state.leaderboard[index] = { ...this.state.leaderboard[index], ...clean };
    } else {
      this.state.leaderboard.push(clean);
      // Bound leaderboard length to prevent memory leak
      if (this.state.leaderboard.length > MAX_LEADERBOARD_ENTRIES) {
        this.state.leaderboard.sort((a, b) => (b.level || 0) - (a.level || 0));
        this.state.leaderboard = this.state.leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
      }
    }
  }

  async updateLeaderboardEntry(entry) {
    await this.init();
    this._upsertLeaderboard(entry);
    await this.persist();
    return entry;
  }

  async getLeaderboard(sortBy = "level", limit = 10) {
    await this.init();
    const validSortKeys = ["level", "kills", "coins", "exp"];
    const sortField = validSortKeys.includes(sortBy) ? sortBy : "level";
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const sorted = [...this.state.leaderboard].sort((a, b) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      if (valB !== valA) return valB - valA;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    return sorted.slice(0, parsedLimit);
  }
}

export const store = new DataStore(config.dataPath);
