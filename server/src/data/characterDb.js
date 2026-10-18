import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

const USER_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
// Vietnamese-friendly: letters (incl. diacritics), digits, space, hyphen, underscore.
const CHARACTER_NAME_REGEX = /^[\p{L}\p{N}_ -]+$/u;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 16;
const GENDERS = ["nam", "nu"];
const DEFAULT_GENDER = "nam";
const MAX_APPEARANCE = 3;

/**
 * Validate a user/account id shared by the character store and its controller.
 * @param {*} id
 * @returns {boolean}
 */
export const isValidUserId = (id) => typeof id === "string" && USER_ID_REGEX.test(id);

/**
 * A user may hold up to MAX_SLOTS active (non-deleted) characters.
 */
export const MAX_CHARACTER_SLOTS = 3;

/**
 * Collapse whitespace and trim a raw name.
 * @param {*} name
 * @returns {string}
 */
const normalizeName = (name) =>
  typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

/**
 * Map a raw SQLite row into a sanitized character object.
 * @param {Object} row
 * @returns {Object|null}
 */
const mapRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    gender: row.gender === "nu" ? "nu" : DEFAULT_GENDER,
    appearance: Number.isInteger(row.appearance) ? row.appearance : 0,
    level: row.level,
    createdAt: row.created_at,
    lastPlayed: row.last_played
  };
};

/**
 * CharacterDatabase
 * SQLite persistence layer for player characters in Giang Ho (jx2-web).
 * A character belongs to a user account and is hard-deleted when removed.
 * Character names are unique across the whole server (case-insensitive).
 */
export class CharacterDatabase {
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

    if (this.dbPath !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        gender TEXT NOT NULL DEFAULT 'nam',
        appearance INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_played INTEGER
      );
    `);

    this._migrateLegacySchema();

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_name
        ON characters(name COLLATE NOCASE);
    `);

    // Migrate older databases that predate the gender/appearance columns.
    const columns = this.db
      .prepare("PRAGMA table_info(characters)")
      .all()
      .map((c) => c.name);
    if (!columns.includes("gender")) {
      this.db.exec("ALTER TABLE characters ADD COLUMN gender TEXT NOT NULL DEFAULT 'nam'");
    }
    if (!columns.includes("appearance")) {
      this.db.exec("ALTER TABLE characters ADD COLUMN appearance INTEGER NOT NULL DEFAULT 0");
    }

    this.stmtListByUser = this.db.prepare(
      "SELECT id, user_id, name, gender, appearance, level, created_at, last_played FROM characters WHERE user_id = ? ORDER BY created_at ASC"
    );
    this.stmtCountByUser = this.db.prepare(
      "SELECT COUNT(*) AS count FROM characters WHERE user_id = ?"
    );
    this.stmtFindByName = this.db.prepare(
      "SELECT id FROM characters WHERE name = ? COLLATE NOCASE"
    );
    this.stmtFindById = this.db.prepare(
      "SELECT id, user_id, name, gender, appearance, level, created_at, last_played FROM characters WHERE id = ? AND user_id = ?"
    );
    this.stmtInsert = this.db.prepare(
      "INSERT INTO characters (id, user_id, name, gender, appearance, level, created_at, last_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    this.stmtDelete = this.db.prepare(
      "DELETE FROM characters WHERE id = ? AND user_id = ?"
    );
  }

  /**
   * Migrate a legacy database that carries the removed soft-delete column:
   * purge soft-deleted rows, drop the per-account index, rename cross-account
   * duplicates (oldest keeps its name), then drop `deleted_at` so the global
   * unique-name index can be created.
   */
  _migrateLegacySchema() {
    const columns = this.db
      .prepare("PRAGMA table_info(characters)")
      .all()
      .map((c) => c.name);
    if (!columns.includes("deleted_at")) {
      this.db.exec("DROP INDEX IF EXISTS idx_characters_user_name");
      return;
    }

    this.db.exec("DELETE FROM characters WHERE deleted_at IS NOT NULL");
    this.db.exec("DROP INDEX IF EXISTS idx_characters_user_name");

    const duplicates = this.db
      .prepare("SELECT name FROM characters GROUP BY name COLLATE NOCASE HAVING COUNT(*) > 1")
      .all();
    const rowsByName = this.db.prepare(
      "SELECT id, name FROM characters WHERE name = ? COLLATE NOCASE ORDER BY created_at ASC, id ASC"
    );
    const rename = this.db.prepare("UPDATE characters SET name = ? WHERE id = ?");
    const nameTaken = this.db.prepare(
      "SELECT 1 AS found FROM characters WHERE name = ? COLLATE NOCASE LIMIT 1"
    );

    for (const { name } of duplicates) {
      const [, ...losers] = rowsByName.all(name);
      for (const loser of losers) {
        rename.run(this._uniqueName(loser.name, nameTaken), loser.id);
      }
    }

    this.db.exec("ALTER TABLE characters DROP COLUMN deleted_at");
  }

  /**
   * Build a name that does not collide with an existing row, staying within
   * MAX_NAME_LENGTH by trimming the original before appending a counter.
   * @param {string} base
   * @param {import("node:sqlite").StatementSync} nameTaken
   * @returns {string}
   */
  _uniqueName(base, nameTaken) {
    let n = 2;
    for (;;) {
      const suffix = `-${n}`;
      const candidate = `${base.slice(0, MAX_NAME_LENGTH - suffix.length)}${suffix}`;
      if (!nameTaken.get(candidate)) return candidate;
      n += 1;
    }
  }

  /**
   * List characters owned by a user, oldest first.
   * @param {string} userId
   * @returns {Object[]}
   */
  listByUser(userId) {
    if (!isValidUserId(userId)) return [];
    return this.stmtListByUser.all(userId).map(mapRow);
  }

  /**
   * Count characters owned by a user.
   * @param {string} userId
   * @returns {number}
   */
  countByUser(userId) {
    if (!isValidUserId(userId)) return 0;
    const row = this.stmtCountByUser.get(userId);
    return row ? Number(row.count) : 0;
  }

  /**
   * Create a character for a user.
   * @param {string} userId
   * @param {string} name
   * @param {string} [gender="nam"] One of GENDERS
   * @param {number} [appearance=0] Portrait index (0..MAX_APPEARANCE)
   * @returns {Object} Sanitized character
   */
  create(userId, name, gender = DEFAULT_GENDER, appearance = 0) {
    if (!isValidUserId(userId)) {
      const err = new Error("Thông tin tài khoản không hợp lệ.");
      err.code = "INVALID_USER";
      throw err;
    }

    const cleanName = normalizeName(name);
    if (
      cleanName.length < MIN_NAME_LENGTH ||
      cleanName.length > MAX_NAME_LENGTH ||
      !CHARACTER_NAME_REGEX.test(cleanName)
    ) {
      const err = new Error(
        `Tên nhân vật phải gồm ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} ký tự chữ, số, khoảng trắng, gạch ngang hoặc gạch dưới.`
      );
      err.code = "INVALID_NAME";
      throw err;
    }

    const cleanGender = gender === undefined || gender === null ? DEFAULT_GENDER : gender;
    if (!GENDERS.includes(cleanGender)) {
      const err = new Error("Giới tính không hợp lệ. Chỉ chấp nhận 'nam' hoặc 'nu'.");
      err.code = "INVALID_GENDER";
      throw err;
    }

    const rawAppearance = Number.isInteger(appearance) ? appearance : 0;
    const cleanAppearance = Math.min(Math.max(rawAppearance, 0), MAX_APPEARANCE);

    if (this.countByUser(userId) >= MAX_CHARACTER_SLOTS) {
      const err = new Error(`Mỗi tài khoản chỉ được tạo tối đa ${MAX_CHARACTER_SLOTS} nhân vật.`);
      err.code = "SLOT_LIMIT";
      throw err;
    }

    if (this.stmtFindByName.get(cleanName)) {
      const err = new Error("Tên nhân vật này đã được sử dụng.");
      err.code = "NAME_TAKEN";
      throw err;
    }

    const id = `char_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const createdAt = Date.now();
    this.stmtInsert.run(id, userId, cleanName, cleanGender, cleanAppearance, 1, createdAt, createdAt);

    return mapRow(this.stmtFindById.get(id, userId));
  }

  /**
   * Permanently delete a character.
   * @param {string} userId
   * @param {string} characterId
   * @returns {boolean} True when a character was deleted
   */
  remove(userId, characterId) {
    if (!isValidUserId(userId) || typeof characterId !== "string") {
      return false;
    }
    const result = this.stmtDelete.run(characterId, userId);
    return result.changes > 0;
  }

  /**
   * Clear all character records (useful for test resets).
   */
  clear() {
    if (this.db) {
      this.db.exec("DELETE FROM characters;");
    }
  }

  /**
   * Close database connection.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const characterDb = new CharacterDatabase();
