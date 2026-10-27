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
