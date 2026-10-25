import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { STARTER_ITEMS, GM_STARTER_ITEMS } from "../../../src/game/items.js";

/** Keys that would poison a plain object (and later SQL params) if copied verbatim. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Columns a leaderboard query may sort by; anything else falls back to `level`. */
const SORT_FIELDS = ["level", "kills", "coins", "exp"];
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/** A character's starting ledger. */
const DEFAULT_LEDGER = { level: 1, exp: 0, coins: 0, kills: 0 };

/**
 * Bumped when a stored inventory must be discarded or back-filled by a migration.
 *  2 — clears the hard-coded demo bags that every character used to start with.
 *  3 — hands the starter kit to characters left with an empty bag.
 */
const SCHEMA_VERSION = 3;

/**
 * Recursively drop prototype-polluting keys from untrusted input.
 * @param {*} value
 * @returns {*}
 */
const sanitizeData = (value) => {
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

const asCount = (value, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

const asName = (value) => (typeof value === "string" ? value : "");

/**
 * Block the current thread for `ms` milliseconds.
 * `node:sqlite` is synchronous, so retrying needs a synchronous sleep.
 * @param {number} ms
 */
const sleepSync = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/**
 * SQLite persistence for a character's progression ledger, inventory and the
 * leaderboard.
 *
 * A single `saves` row is the source of truth for a character, and the
 * leaderboard is a *view* over that table (there is no separate table), so a
 * player's rank can never drift from their progress.
 */
export class PlayerDatabase {
  constructor(dbPath = config.dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this._init();
  }

  _init() {
    if (this.dbPath !== ":memory:") {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(this.dbPath);

    // Wait instead of throwing SQLITE_BUSY when another connection is mid-write.
    this.db.exec("PRAGMA busy_timeout = 5000;");

    if (this.dbPath !== ":memory:") {
      this._enableWal();
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS saves (
        player_id       TEXT PRIMARY KEY,
        player_name     TEXT NOT NULL DEFAULT '',
        level           INTEGER NOT NULL DEFAULT 1,
        kills           INTEGER NOT NULL DEFAULT 0,
        coins           INTEGER NOT NULL DEFAULT 0,
        exp             INTEGER NOT NULL DEFAULT 0,
        quest_rewarded  INTEGER NOT NULL DEFAULT 0,
        inventory       TEXT NOT NULL DEFAULT '{}',
        starter_granted INTEGER NOT NULL DEFAULT 0,
        updated_at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_saves_level ON saves(level DESC);
      CREATE INDEX IF NOT EXISTS idx_saves_kills ON saves(kills DESC);
      CREATE INDEX IF NOT EXISTS idx_saves_coins ON saves(coins DESC);
      CREATE INDEX IF NOT EXISTS idx_saves_exp   ON saves(exp DESC);
    `);

    // Databases created before the flag existed need the column added, because
    // `CREATE TABLE IF NOT EXISTS` never alters an existing table.
    const saveColumns = this.db.prepare("PRAGMA table_info(saves)").all();
    if (!saveColumns.some((column) => column.name === "starter_granted")) {
      this.db.exec(
        "ALTER TABLE saves ADD COLUMN starter_granted INTEGER NOT NULL DEFAULT 0"
      );
    }

    this._migrate();

    this.stmtGet = this.db.prepare("SELECT * FROM saves WHERE player_id = ?");
    this.stmtCount = this.db.prepare("SELECT COUNT(*) AS count FROM saves");
    this.stmtUpdateInventory = this.db.prepare(
      "UPDATE saves SET inventory = ?, updated_at = ? WHERE player_id = ?"
    );
    this.stmtGrantStarter = this.db.prepare(
      // The emptiness predicate is part of the guard, not the caller's discipline:
      // a played bag can never be replaced by the starter kit, regardless of who
      // calls grantStarterItems().
      `UPDATE saves SET inventory = ?, starter_granted = 1, updated_at = ?
       WHERE player_id = ? AND starter_granted = 0
         AND (inventory IS NULL OR inventory = '' OR inventory = '{}')`
    );
    this.stmtUpdateLedger = this.db.prepare(
      `UPDATE saves SET level = ?, exp = ?, coins = ?, kills = ?, player_name = ?, updated_at = ?
       WHERE player_id = ?`
    );
    this.stmtUpdateRank = this.db.prepare(
      `UPDATE saves SET player_name = ?, level = ?, kills = ?, coins = ?, exp = ?, updated_at = ?
       WHERE player_id = ?`
    );
    this.stmtSetQuestRewarded = this.db.prepare(
      "UPDATE saves SET quest_rewarded = ?, updated_at = ? WHERE player_id = ?"
    );
    // One prepared ranking query per sortable column (whitelisted, so the
    // interpolated column name can never be attacker-controlled).
    this.stmtLeaderboard = Object.fromEntries(
      SORT_FIELDS.map((field) => [
        field,
        this.db.prepare(
          `SELECT player_id, player_name, level, kills, coins, exp, updated_at
           FROM saves ORDER BY ${field} DESC, updated_at DESC LIMIT ?`
        )
      ])
    );
    this.stmtUpsert = this.db.prepare(`
      INSERT INTO saves (
        player_id, player_name, level, kills, coins, exp, quest_rewarded, inventory, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        player_name = excluded.player_name,
        level = excluded.level,
        kills = excluded.kills,
        coins = excluded.coins,
        exp = excluded.exp,
        quest_rewarded = excluded.quest_rewarded,
        inventory = excluded.inventory,
        updated_at = excluded.updated_at
    `);
  }

  /**
   * Switch the connection to WAL mode.
   *
   * `PRAGMA journal_mode` briefly needs an exclusive lock, so `node --watch`
   * restarting the API while the previous process is still closing its
   * connection can throw SQLITE_BUSY ("database is locked") and take the whole
   * server down. Retry a few times, then fall back to the rollback journal: WAL
   * is a performance choice, not a correctness requirement.
   */
  _enableWal(attempts = 10) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        this.db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
        return;
      } catch (error) {
        if (attempt === attempts - 1) {
          console.warn(
            `[DB] Không bật được WAL (${error.message}); tiếp tục ở chế độ rollback journal.`
          );
          return;
        }
        sleepSync(100 * (attempt + 1));
      }
    }
  }

  /**
   * Close the underlying SQLite connection so a restarting process releases the
   * file lock immediately instead of waiting for the OS to reap it.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Apply pending schema migrations, tracked in SQLite's `user_version`.
   *
   * Version 2 wipes every stored bag: earlier builds seeded each character with a
   * hard-coded demo inventory, and clearing it once is the only way an existing
   * save cannot bring those stacks back.
   *
   * Version 3 back-fills those emptied bags with the starter kit, so characters
   * created before the kit existed are not left empty-handed.
   *
   * Running once is enforced by the version check, so real items acquired later
   * are never touched again.
   */
  _migrate() {
    const row = this.db.prepare("PRAGMA user_version").get();
    const currentVersion = Number(row?.user_version) || 0;
    if (currentVersion >= SCHEMA_VERSION) return;

    if (currentVersion < 2) {
      this.db.exec("UPDATE saves SET inventory = '{}'");
    }

    if (currentVersion < 3) {
      this.db
        .prepare(
          `UPDATE saves
              SET inventory = ?, starter_granted = 1, updated_at = ?
            WHERE starter_granted = 0
              AND (inventory IS NULL OR inventory = '' OR inventory = '{}')`
        )
        .run(JSON.stringify(STARTER_ITEMS), Date.now());
    }

    this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  _parseInventory(raw) {
    try {
      const parsed = JSON.parse(raw || "{}");
      return sanitizeData(parsed) || {};
    } catch {
      return {};
    }
  }

  /**
   * Insert or replace a whole row from already-normalized column values.
   * @param {{playerId:string, playerName:string, level:number, kills:number, coins:number,
   *   exp:number, questRewarded:number, inventory:Object, updatedAt:number}} row
   */
  _writeRow(row) {
    this.stmtUpsert.run(
      row.playerId,
      row.playerName,
      row.level,
      row.kills,
      row.coins,
      row.exp,
      row.questRewarded,
      JSON.stringify(row.inventory || {}),
      row.updatedAt
    );
  }

  // --- Progression ledger (server-authoritative economy) ---

  /**
   * The character's progression ledger, or null when it has never played.
   * @param {string} playerId
   * @returns {{level:number, exp:number, coins:number, kills:number, questRewarded:boolean}|null}
   */
  getProgress(playerId) {
    const row = this.stmtGet.get(playerId);
    if (!row) return null;
    return {
      level: row.level,
      exp: row.exp,
      coins: row.coins,
      kills: row.kills,
      questRewarded: Boolean(row.quest_rewarded)
    };
  }

  /**
   * Persist the ledger, creating the row on first write. `playerName` is the
   * account's authoritative display name; an empty value keeps whatever is stored
   * (so a join without a resolved name never blanks an existing one).
   * @param {string} playerId
   * @param {{level:number, exp:number, coins:number, kills:number}} progress
   * @param {string} [playerName]
   */
  setProgress(playerId, progress, playerName = "") {
    const existing = this.stmtGet.get(playerId);
    const name = playerName || (existing ? existing.player_name : "");
    const now = Date.now();

    if (existing) {
      this.stmtUpdateLedger.run(
        progress.level,
        progress.exp,
        progress.coins,
        progress.kills,
        name,
        now,
        playerId
      );
    } else {
      this._writeRow({
        playerId,
        playerName: name,
        ...DEFAULT_LEDGER,
        ...progress,
        questRewarded: 0,
        inventory: {},
        updatedAt: now
      });
    }
  }

  /**
   * Mark whether the one-off quest reward has been paid, so it can never be
   * claimed twice.
   * @param {string} playerId
   * @param {boolean} rewarded
   */
  setQuestRewarded(playerId, rewarded) {
    this.stmtSetQuestRewarded.run(rewarded ? 1 : 0, Date.now(), playerId);
  }

  // --- Inventory ---

  getInventory(playerId) {
    const row = this.stmtGet.get(playerId);
    return row ? this._parseInventory(row.inventory) : {};
  }

  setInventory(playerId, inventory) {
    const cleanInventory = sanitizeData(inventory) || {};
    const existing = this.stmtGet.get(playerId);

    if (existing) {
      this.stmtUpdateInventory.run(JSON.stringify(cleanInventory), Date.now(), playerId);
    } else {
      this._writeRow({
        playerId,
        playerName: "",
        ...DEFAULT_LEDGER,
        questRewarded: 0,
        inventory: cleanInventory,
        updatedAt: Date.now()
      });
    }

    return this.getInventory(playerId);
  }

  /**
   * Give an empty character the shared starter kit, at most once. Called when a
   * character is created; the flag plus the empty-bag guard guarantee a character
   * that already owns something (or later spends everything) is never overwritten
   * nor re-granted free items.
   * @param {string} playerId
   * @returns {Record<string, number>} the stored bag
   */
  grantStarterItems(playerId, { isAdmin = false } = {}) {
    const now = Date.now();

    if (!this.stmtGet.get(playerId)) {
      this._writeRow({
        playerId,
        playerName: "",
        ...DEFAULT_LEDGER,
        questRewarded: 0,
        inventory: {},
        updatedAt: now
      });
    }

    const starter = isAdmin ? GM_STARTER_ITEMS : STARTER_ITEMS;
    this.stmtGrantStarter.run(JSON.stringify(starter), now, playerId);
    return this.getInventory(playerId);
  }

  // --- Leaderboard (a view over `saves`) ---

  /**
   * Insert or merge a leaderboard-only entry into `saves`. Existing inventory is
   * preserved; only the ranked fields are overwritten.
   * @param {{playerId:string, playerName?:string, level?:number, kills?:number, coins?:number, exp?:number}} entry
   * @returns {Object|null} the stored ranking row
   */
  updateLeaderboardEntry(entry) {
    const clean = sanitizeData(entry) || {};
    if (!clean.playerId) return entry;
    const now = Date.now();

    const existing = this.stmtGet.get(clean.playerId);
    if (existing) {
      this.stmtUpdateRank.run(
        clean.playerName !== undefined ? asName(clean.playerName) : existing.player_name,
        asCount(clean.level, existing.level),
        asCount(clean.kills, existing.kills),
        asCount(clean.coins, existing.coins),
        asCount(clean.exp, existing.exp),
        now,
        clean.playerId
      );
    } else {
      this._writeRow({
        playerId: clean.playerId,
        playerName: asName(clean.playerName),
        level: asCount(clean.level, DEFAULT_LEDGER.level),
        kills: asCount(clean.kills, DEFAULT_LEDGER.kills),
        coins: asCount(clean.coins, DEFAULT_LEDGER.coins),
        exp: asCount(clean.exp, DEFAULT_LEDGER.exp),
        questRewarded: 0,
        inventory: {},
        updatedAt: now
      });
    }

    return this.getLeaderboardEntry(clean.playerId);
  }

  getLeaderboardEntry(playerId) {
    const row = this.stmtGet.get(playerId);
    if (!row) return null;
    return {
      playerId: row.player_id,
      playerName: row.player_name,
      level: row.level,
      kills: row.kills,
      coins: row.coins,
      exp: row.exp,
      updatedAt: row.updated_at
    };
  }

  getLeaderboard(sortBy = "level", limit = DEFAULT_LIMIT) {
    const sortField = SORT_FIELDS.includes(sortBy) ? sortBy : "level";
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const rows = this.stmtLeaderboard[sortField].all(parsedLimit);

    return rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      level: row.level,
      kills: row.kills,
      coins: row.coins,
      exp: row.exp,
      updatedAt: row.updated_at
    }));
  }

  countLeaderboard() {
    return this.stmtCount.get().count;
  }
}

export const store = new PlayerDatabase();
