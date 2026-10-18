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
    lastPlayed: row.last_played,
    deletedAt: row.deleted_at
  };
};

/**
 * CharacterDatabase
 * SQLite persistence layer for player characters in Giang Ho (jx2-web).
 * Characters are owned by a user account and soft-deleted so they can be
 * restored from the character-selection screen.
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
        last_played INTEGER,
        deleted_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_user_name
        ON characters(user_id, name COLLATE NOCASE)
        WHERE deleted_at IS NULL;
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
      "SELECT id, user_id, name, gender, appearance, level, created_at, last_played, deleted_at FROM characters WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
    );
    this.stmtCountActive = this.db.prepare(
      "SELECT COUNT(*) AS count FROM characters WHERE user_id = ? AND deleted_at IS NULL"
    );
    this.stmtCountDeleted = this.db.prepare(
      "SELECT COUNT(*) AS count FROM characters WHERE user_id = ? AND deleted_at IS NOT NULL"
    );
    this.stmtFindActiveByName = this.db.prepare(
      "SELECT id FROM characters WHERE user_id = ? AND name = ? COLLATE NOCASE AND deleted_at IS NULL"
    );
    this.stmtFindActiveById = this.db.prepare(
      "SELECT id, user_id, name, gender, appearance, level, created_at, last_played, deleted_at FROM characters WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    );
    this.stmtFindLastDeleted = this.db.prepare(
      "SELECT id, user_id, name, gender, appearance, level, created_at, last_played, deleted_at FROM characters WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 1"
    );
    this.stmtInsert = this.db.prepare(
      "INSERT INTO characters (id, user_id, name, gender, appearance, level, created_at, last_played, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)"
    );
    this.stmtSoftDelete = this.db.prepare(
      "UPDATE characters SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    );
    this.stmtRestore = this.db.prepare(
      "UPDATE characters SET deleted_at = NULL WHERE id = ? AND user_id = ?"
    );
  }

  /**
   * List active characters for a user, oldest first.
   * @param {string} userId
   * @returns {Object[]}
   */
  listByUser(userId) {
    if (!isValidUserId(userId)) return [];
    return this.stmtListByUser.all(userId).map(mapRow);
  }

  /**
   * Count active characters for a user.
   * @param {string} userId
   * @returns {number}
   */
  countActiveByUser(userId) {
    if (!isValidUserId(userId)) return 0;
    const row = this.stmtCountActive.get(userId);
    return row ? Number(row.count) : 0;
  }

  /**
   * Count soft-deleted characters available for restore.
   * @param {string} userId
   * @returns {number}
   */
  countDeletedByUser(userId) {
    if (!isValidUserId(userId)) return 0;
    const row = this.stmtCountDeleted.get(userId);
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

    if (this.countActiveByUser(userId) >= MAX_CHARACTER_SLOTS) {
      const err = new Error(`Mỗi tài khoản chỉ được tạo tối đa ${MAX_CHARACTER_SLOTS} nhân vật.`);
      err.code = "SLOT_LIMIT";
      throw err;
    }

    if (this.stmtFindActiveByName.get(userId, cleanName)) {
      const err = new Error("Tên nhân vật này đã tồn tại trong tài khoản.");
      err.code = "NAME_TAKEN";
      throw err;
    }

    const id = `char_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const createdAt = Date.now();
    this.stmtInsert.run(id, userId, cleanName, cleanGender, cleanAppearance, 1, createdAt, createdAt);

    return mapRow(this.stmtFindActiveById.get(id, userId));
  }

  /**
   * Soft-delete a character.
   * @param {string} userId
   * @param {string} characterId
   * @returns {boolean} True when a character was deleted
   */
  softDelete(userId, characterId) {
    if (!isValidUserId(userId) || typeof characterId !== "string") {
      return false;
    }
    const result = this.stmtSoftDelete.run(Date.now(), characterId, userId);
    return result.changes > 0;
  }

  /**
   * Restore the most recently deleted character for a user.
   * @param {string} userId
   * @returns {Object|null} Restored character or null when none available
   */
  restoreLast(userId) {
    if (!isValidUserId(userId)) return null;

    const row = this.stmtFindLastDeleted.get(userId);
    if (!row) return null;

    if (this.countActiveByUser(userId) >= MAX_CHARACTER_SLOTS) {
      const err = new Error(`Mỗi tài khoản chỉ được tạo tối đa ${MAX_CHARACTER_SLOTS} nhân vật.`);
      err.code = "SLOT_LIMIT";
      throw err;
    }

    if (this.stmtFindActiveByName.get(userId, row.name)) {
      const err = new Error("Không thể khôi phục vì đã có nhân vật trùng tên.");
      err.code = "NAME_TAKEN";
      throw err;
    }

    this.stmtRestore.run(row.id, userId);
    return mapRow(this.stmtFindActiveById.get(row.id, userId));
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
