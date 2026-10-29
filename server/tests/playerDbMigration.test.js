import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * A database that predates the nullable vitals: hp/mp were NOT NULL with
 * defaults, while new characters now store NULL until their first join.
 */
async function makeLegacyDb() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-legacy-save-"));
  const dbPath = path.join(dir, "legacy.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE saves (
      player_id       TEXT PRIMARY KEY,
      player_name     TEXT NOT NULL DEFAULT '',
      level           INTEGER NOT NULL DEFAULT 1,
      kills           INTEGER NOT NULL DEFAULT 0,
      coins           INTEGER NOT NULL DEFAULT 0,
      exp             INTEGER NOT NULL DEFAULT 0,
      hp              INTEGER NOT NULL DEFAULT 100,
      mp              INTEGER NOT NULL DEFAULT 80,
      position_x      REAL,
      position_y      REAL,
      quest_rewarded  INTEGER NOT NULL DEFAULT 0,
      audio_enabled   INTEGER NOT NULL DEFAULT 1,
      inventory       TEXT NOT NULL DEFAULT '{}',
      updated_at      INTEGER NOT NULL
    );
    INSERT INTO saves (player_id, player_name, level, updated_at)
    VALUES ('char_legacy', 'Cựu Hiệp', 7, 1);
  `);
  db.close();
  return { dir, dbPath };
}

test("a legacy NOT NULL hp/mp schema is rebuilt so new characters can be saved", async () => {
  const { dir, dbPath } = await makeLegacyDb();
  try {
    // The module also constructs a default `store`; point it at a throwaway file
    // so this test never touches the developer's real database.
    process.env.DB_PATH = path.join(dir, "singleton.sqlite");
    const { PlayerDatabase } = await import("../src/data/playerDb.js");
    const store = new PlayerDatabase(dbPath);

    const columns = store.db.prepare("PRAGMA table_info(saves)").all();
    const hp = columns.find((column) => column.name === "hp");
    const mp = columns.find((column) => column.name === "mp");
    assert.equal(hp.notnull, 0, "hp accepts NULL after the rebuild");
    assert.equal(mp.notnull, 0, "mp accepts NULL after the rebuild");

    const legacy = store.getProgress("char_legacy");
    assert.equal(legacy.level, 7, "existing rows survive the rebuild");
    assert.equal(
      store.db.prepare("SELECT player_name FROM saves WHERE player_id = ?").get("char_legacy")
        .player_name,
      "Cựu Hiệp",
      "the row's identity survives the rebuild"
    );

    // This is the write that used to fail with NOT NULL constraint on old saves.
    assert.doesNotThrow(() => store.grantStarterItems("char_legacy"));
    store.setProgress("char_new", { level: 1, exp: 0, coins: 0, kills: 0 }, "Tân Hiệp");
    assert.equal(store.getProgress("char_new").level, 1);

    const indexes = store.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'saves'")
      .all()
      .map((row) => row.name);
    assert.ok(indexes.includes("idx_saves_level"), "leaderboard indexes are recreated");

    store.db.close();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

/**
 * A database saved while skills were learned from books: bags hold `book_*`
 * stacks, `characters.sect` is the legacy `none`, and learned lists mix arts of
 * several schools with the retired `kiem_khi`.
 */
async function makePreSectDb() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-sect-save-"));
  const dbPath = path.join(dir, "sect.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE characters (
      id     TEXT PRIMARY KEY,
      sect   TEXT NOT NULL DEFAULT 'none',
      gender TEXT NOT NULL DEFAULT 'male'
    );
    CREATE TABLE saves (
      player_id       TEXT PRIMARY KEY,
      player_name     TEXT NOT NULL DEFAULT '',
      level           INTEGER NOT NULL DEFAULT 1,
      kills           INTEGER NOT NULL DEFAULT 0,
      coins           INTEGER NOT NULL DEFAULT 0,
      exp             INTEGER NOT NULL DEFAULT 0,
      quest_rewarded  INTEGER NOT NULL DEFAULT 0,
      inventory       TEXT NOT NULL DEFAULT '{}',
      equipment       TEXT NOT NULL DEFAULT '{}',
      learned_skills  TEXT NOT NULL DEFAULT '[]',
      skill_levels    TEXT NOT NULL DEFAULT '{}',
      updated_at      INTEGER NOT NULL
    );
    INSERT INTO characters (id, sect, gender) VALUES ('char_fist', 'none', 'male');
    INSERT INTO characters (id, sect, gender) VALUES ('char_sword', 'none', 'female');
    INSERT INTO characters (id, sect, gender) VALUES ('char_mislabelled', 'thieu-lam', 'male');
    INSERT INTO saves (player_id, inventory, equipment, learned_skills, skill_levels, updated_at)
    VALUES (
      'char_fist',
      '{"book_thieu_lam_tam_phap":1,"book_nga_my_kiem_phap":2,"kim-sang-duoc":5}',
      '{"weapon":"bao-tay-lang-khach"}',
      '["kiem_khi","thieu_lam_tam_phap","nga_my_kiem_phap"]',
      '{"thieu_lam_tam_phap":3,"nga_my_kiem_phap":2}',
      1
    );
    INSERT INTO saves (player_id, equipment, learned_skills, updated_at)
    VALUES ('char_sword', '{}', '["kiem_khi"]', 1);
    INSERT INTO saves (player_id, equipment, learned_skills, skill_levels, updated_at)
    VALUES (
      'char_mislabelled',
      '{"weapon":"kiem-lang-khach"}',
      '["kiem_khi","thieu_duong_kiem_phap","thai_cuc_quyen"]',
      '{"thai_cuc_quyen":2}',
      1
    );
    PRAGMA user_version = 8;
  `);
  db.close();
  return { dir, dbPath };
}

test("skill books are stripped and learned arts move onto the hero's sect kit", async () => {
  const { dir, dbPath } = await makePreSectDb();
  try {
    process.env.DB_PATH = path.join(dir, "singleton.sqlite");
    const { PlayerDatabase } = await import("../src/data/playerDb.js");
    const store = new PlayerDatabase(dbPath);

    // The fist arts outnumber the sword art, so the hero joins Thiếu Lâm, and the
    // book stacks (now dead items) are gone while real loot survives.
    assert.equal(
      store.db.prepare("SELECT sect FROM characters WHERE id = ?").get("char_fist").sect,
      "thieu-lam"
    );
    assert.deepEqual(Object.keys(store.getInventory("char_fist")).sort(), ["kim-sang-duoc"]);
    assert.deepEqual(store.getLearnedSkills("char_fist"), ["thieu_lam_tam_phap"]);
    assert.deepEqual(store.getSkillLevels("char_fist"), { thieu_lam_tam_phap: 3 });

    // A female hero left with only the retired starter falls back to Nga My and
    // receives that sect's starter art.
    assert.equal(
      store.db.prepare("SELECT sect FROM characters WHERE id = ?").get("char_sword").sect,
      "nga-my"
    );
    assert.deepEqual(store.getLearnedSkills("char_sword"), ["nga_my_kiem_phap"]);

    // The old migration stamped 'thieu-lam' on pre-sect rows; the studied sword
    // arts are the real evidence, so the hero moves to Võ Đang with its kit.
    assert.equal(
      store.db.prepare("SELECT sect FROM characters WHERE id = ?").get("char_mislabelled").sect,
      "vo-dang"
    );
    assert.deepEqual(store.getLearnedSkills("char_mislabelled"), [
      "thieu_duong_kiem_phap",
      "thai_cuc_quyen"
    ]);
    assert.deepEqual(store.getSkillLevels("char_mislabelled"), { thai_cuc_quyen: 2 });

    store.db.close();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
