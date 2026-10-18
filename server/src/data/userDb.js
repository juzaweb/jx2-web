import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 50;

/**
 * UserDatabase
 * SQLite persistence layer for user accounts in Giang Ho (jx2-web)
 */
export class UserDatabase {
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

    // Create users table and index
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        display_name TEXT,
        created_at INTEGER NOT NULL,
        last_login INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    // Prepare statement caches
    this.stmtFindByUsername = this.db.prepare(
      "SELECT id, username, password_hash, salt, display_name, created_at, last_login FROM users WHERE username = ?"
    );
    this.stmtFindById = this.db.prepare(
      "SELECT id, username, display_name, created_at, last_login FROM users WHERE id = ?"
    );
    this.stmtInsertUser = this.db.prepare(
      "INSERT INTO users (id, username, password_hash, salt, display_name, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    this.stmtUpdateLastLogin = this.db.prepare(
      "UPDATE users SET last_login = ? WHERE id = ?"
    );
  }

  /**
   * Register a new user
   * @param {string} username
   * @param {string} password
   * @param {string} [displayName]
   * @returns {Object} Sanitized user profile
   */
  register(username, password, displayName = "") {
    if (!username || typeof username !== "string" || !USERNAME_REGEX.test(username.trim())) {
      const err = new Error("Tên tài khoản phải gồm 3-30 ký tự chữ cái, số hoặc dấu gạch dưới.");
      err.code = "INVALID_USERNAME";
      throw err;
    }

    if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      const err = new Error(`Mật khẩu phải có độ dài tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`);
      err.code = "INVALID_PASSWORD";
      throw err;
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      const err = new Error(`Mật khẩu không được vượt quá ${MAX_PASSWORD_LENGTH} ký tự.`);
      err.code = "INVALID_PASSWORD";
      throw err;
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = this.stmtFindByUsername.get(cleanUsername);
    if (existing) {
      const err = new Error("Tài khoản này đã tồn tại trong giang hồ.");
      err.code = "USER_EXISTS";
      throw err;
    }

    const cleanDisplayName = typeof displayName === "string" && displayName.trim()
      ? displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH)
      : username.trim();

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
    const id = `user_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const createdAt = Date.now();

    this.stmtInsertUser.run(id, cleanUsername, passwordHash, salt, cleanDisplayName, createdAt, null);

    return {
      id,
      username: cleanUsername,
      displayName: cleanDisplayName,
      createdAt,
      lastLogin: null
    };
  }

  /**
   * Authenticate user credentials
   * @param {string} username
   * @param {string} password
   * @returns {Object} Sanitized user profile
   */
  login(username, password) {
    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string" ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      const err = new Error("Tài khoản hoặc mật khẩu không chính xác.");
      err.code = "INVALID_CREDENTIALS";
      throw err;
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = this.stmtFindByUsername.get(cleanUsername);

    if (!user) {
      const err = new Error("Tài khoản hoặc mật khẩu không chính xác.");
      err.code = "INVALID_CREDENTIALS";
      throw err;
    }

    const candidateHash = crypto.scryptSync(password, user.salt, 64).toString("hex");
    const candidateBuf = Buffer.from(candidateHash, "hex");
    const storedBuf = Buffer.from(user.password_hash, "hex");

    if (candidateBuf.length !== storedBuf.length || !crypto.timingSafeEqual(candidateBuf, storedBuf)) {
      const err = new Error("Tài khoản hoặc mật khẩu không chính xác.");
      err.code = "INVALID_CREDENTIALS";
      throw err;
    }

    const now = Date.now();
    this.stmtUpdateLastLogin.run(now, user.id);

    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      createdAt: user.created_at,
      lastLogin: now
    };
  }

  /**
   * Get user profile by ID
   * @param {string} id
   * @returns {Object|null}
   */
  getUserById(id) {
    if (!id || typeof id !== "string") return null;
    const user = this.stmtFindById.get(id);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
  }

  /**
   * Clear all records in users table (useful for test resets)
   */
  clear() {
    if (this.db) {
      this.db.exec("DELETE FROM users;");
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const userDb = new UserDatabase();
