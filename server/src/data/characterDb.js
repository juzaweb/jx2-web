import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";
import { DEFAULT_FACTION, isFactionId, normalizeFaction } from "../../../src/game/factions.js";

const USER_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
// Vietnamese-friendly: letters (incl. diacritics), digits, space, hyphen, underscore.
const CHARACTER_NAME_REGEX = /^[\p{L}\p{N}_ -]+$/u;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 16;

/**
 * Playable genders. Sects are gone: a hero's skill kit is decided by the weapon
 * worn in the `weapon` equipment slot, not by a character class.
 */
const GENDERS = ["male", "female"];
const DEFAULT_GENDER = "male";

/**
 * Legacy `sect` column value. The column is kept so older databases keep their
 * shape, but nothing reads it any more.
 */
const LEGACY_SECT = "none";

/**
 * Normalise an unknown gender to the default.
 * @param {*} gender
 * @returns {string}
 */
const normalizeGender = (gender) => (GENDERS.includes(gender) ? gender : DEFAULT_GENDER);
// SQLite extended result code for a UNIQUE constraint violation.
const SQLITE_CONSTRAINT_UNIQUE = 2067;

/**
 * True when a SQLite error is a UNIQUE-constraint violation.
 * @param {*} error
 * @returns {boolean}
 */
const isUniqueViolation = (error) =>
  Boolean(error) &&
  (error.errcode === SQLITE_CONSTRAINT_UNIQUE ||
    /UNIQUE constraint failed/i.test(error.message || ""));

/**
 * Build the product-facing NAME_TAKEN error used by both the pre-check and the
 * unique-index backstop.
 * @returns {Error}
 */
const nameTakenError = () => {
  const err = new Error("Tên nhân vật này đã được sử dụng.");
  err.code = "NAME_TAKEN";
  return err;
};

/**
 * Validate a user/account id shared by the character store and its controller.
 * @param {*} id
 * @returns {boolean}
 */
export const isValidUserId = (id) => typeof id === "string" && USER_ID_REGEX.test(id);

/**
 * A user may hold up to MAX_CHARACTER_SLOTS characters.
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
    gender: normalizeGender(row.gender),    faction: normalizeFaction(row.faction),    appearance: Number.isInteger(row.appearance) ? row.appearance : 0,
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
        sect TEXT NOT NULL DEFAULT 'thieu-lam',
        gender TEXT NOT NULL DEFAULT 'male',
        faction TEXT NOT NULL DEFAULT 'ngo',
        appearance INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_played INTEGER
      );
    `);

    this._migrateSchema();

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
      this.db.exec("ALTER TABLE characters ADD COLUMN gender TEXT NOT NULL DEFAULT 'male'");
    }
    if (!columns.includes("appearance")) {
      this.db.exec("ALTER TABLE characters ADD COLUMN appearance INTEGER NOT NULL DEFAULT 0");
    }
    if (!columns.includes("faction")) {
      // Every pre-faction save is assigned the Ngô capital so nothing is orphaned.
      this.db.exec(
        `ALTER TABLE characters ADD COLUMN faction TEXT NOT NULL DEFAULT '${DEFAULT_FACTION}'`
      );
    }
    const addedSect = !columns.includes("sect");
    if (addedSect) {
      this.db.exec("ALTER TABLE characters ADD COLUMN sect TEXT NOT NULL DEFAULT 'thieu-lam'");
    }

    // Normalise legacy gender values ("nam"/"nu") to the current English keys.
    this.db.exec(`
      UPDATE characters SET gender = 'female' WHERE gender = 'nu';
      UPDATE characters SET gender = 'male' WHERE gender = 'nam';
    `);

    if (addedSect) {
      // Existing female characters are mapped to Nga My; all others keep the
      // default sect (Thiếu Lâm).
      this.db.exec("UPDATE characters SET sect = 'nga-my' WHERE gender = 'female'");
    }

    this.stmtListByUser = this.db.prepare(
      "SELECT id, user_id, name, sect, gender, faction, appearance, level, created_at, last_played FROM characters WHERE user_id = ? ORDER BY created_at ASC"
    );
    this.stmtCountByUser = this.db.prepare(
      "SELECT COUNT(*) AS count FROM characters WHERE user_id = ?"
    );
    this.stmtFindByName = this.db.prepare(
      "SELECT id FROM characters WHERE name = ? COLLATE NOCASE"
    );
    this.stmtFindById = this.db.prepare(
      "SELECT id, user_id, name, sect, gender, faction, appearance, level, created_at, last_played FROM characters WHERE id = ? AND user_id = ?"
    );
    this.stmtInsert = this.db.prepare(
      "INSERT INTO characters (id, user_id, name, sect, gender, faction, level, created_at, last_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    this.stmtDelete = this.db.prepare(
      "DELETE FROM characters WHERE id = ? AND user_id = ?"
    );
  }

  /**
   * Bring an existing database in line with the current schema before the
   * global unique-name index is created: purge soft-deleted rows, drop the
   * obsolete per-account index, rename cross-account duplicates (oldest keeps
   * its name), then drop the removed `deleted_at` column. No-ops (and takes no
   * write lock) once the schema is current, so workers sharing a database file
   * only contend on the very first, real migration. Runs in one transaction so
   * a failure leaves the database untouched.
   */
  _migrateSchema() {
    if (!this._needsMigration()) return;

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this._purgeSoftDeleted();
      this._dedupeNames();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * True when the database still carries the legacy soft-delete shape or holds
   * cross-account name duplicates that would block the unique index.
   * @returns {boolean}
   */
  _needsMigration() {
    const hasDeletedAt = this.db
      .prepare("PRAGMA table_info(characters)")
      .all()
      .some((c) => c.name === "deleted_at");
    if (hasDeletedAt) return true;

    const indexes = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row) => row.name);
    if (indexes.includes("idx_characters_user_name")) return true;
    // Once the global unique index exists, duplicate names are impossible, so
    // there is nothing to scan for or migrate.
    if (indexes.includes("idx_characters_name")) return false;

    const duplicate = this.db
      .prepare("SELECT name FROM characters GROUP BY name COLLATE NOCASE HAVING COUNT(*) > 1 LIMIT 1")
      .get();
    return Boolean(duplicate);
  }

  /**
   * Drop the obsolete per-account index and, when present, the soft-delete
   * rows and column.
   */
  _purgeSoftDeleted() {
    this.db.exec("DROP INDEX IF EXISTS idx_characters_user_name");

    const columns = this.db
      .prepare("PRAGMA table_info(characters)")
      .all()
      .map((c) => c.name);
    if (!columns.includes("deleted_at")) return;

    this.db.exec("DELETE FROM characters WHERE deleted_at IS NOT NULL");
    this.db.exec("ALTER TABLE characters DROP COLUMN deleted_at");
  }

  /**
   * Rename cross-account duplicates so the global unique-name index can be
   * created. The oldest row of each group keeps its name; later rows gain a
   * `-<n>` suffix.
   */
  _dedupeNames() {
    const duplicates = this.db
      .prepare("SELECT name FROM characters GROUP BY name COLLATE NOCASE HAVING COUNT(*) > 1")
      .all();
    if (duplicates.length === 0) return;

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
   * Whether `characterId` belongs to `userId`. Used to keep a session from acting
   * on another account's character.
   * @param {string} userId
   * @param {string} characterId
   * @returns {boolean}
   */
  ownsCharacter(userId, characterId) {
    if (!isValidUserId(userId) || typeof characterId !== "string" || !characterId) {
      return false;
    }
    return Boolean(this.stmtFindById.get(characterId, userId));
  }

  /**
   * Fetch a character owned by a user.
   * @param {string} userId
   * @param {string} characterId
   * @returns {Object|null} Sanitized character or null
   */
  findById(userId, characterId) {
    if (!isValidUserId(userId) || typeof characterId !== "string" || !characterId) return null;
    return mapRow(this.stmtFindById.get(characterId, userId));
  }

  /**
   * Resolve the owner user ID of a character
   * @param {string} characterId
   * @returns {string|null}
   */
  getOwner(characterId) {
    if (!characterId || typeof characterId !== "string") return null;
    try {
      const row = this.db.prepare("SELECT user_id FROM characters WHERE id = ?").get(characterId);
      return row ? row.user_id : null;
    } catch {
      return null;
    }
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
   * @param {"male"|"female"} [gender="male"]
   * @param {"ngo"|"thuc"|"nguy"} [faction="ngo"]
   * @returns {Object} Sanitized character
   */
  create(userId, name, gender = DEFAULT_GENDER, faction = DEFAULT_FACTION) {
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

    const cleanGender = normalizeGender(gender);
    if (!isFactionId(faction)) {
      const err = new Error("Phe phái không hợp lệ.");
      err.code = "INVALID_FACTION";
      throw err;
    }
    const cleanFaction = normalizeFaction(faction);

    if (this.countByUser(userId) >= MAX_CHARACTER_SLOTS) {
      const err = new Error(`Mỗi tài khoản chỉ được tạo tối đa ${MAX_CHARACTER_SLOTS} nhân vật.`);
      err.code = "SLOT_LIMIT";
      throw err;
    }

    if (this.stmtFindByName.get(cleanName)) {
      throw nameTakenError();
    }

    const id = `char_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const createdAt = Date.now();
    try {
      this.stmtInsert.run(
        id,
        userId,
        cleanName,
        LEGACY_SECT,
        cleanGender,
        cleanFaction,
        1,
        createdAt,
        createdAt
      );
    } catch (error) {
      // The unique index is the ultimate guard: a concurrent writer (multiple
      // server processes sharing the file) can slip past the check above.
      if (isUniqueViolation(error)) throw nameTakenError();
      throw error;
    }

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
