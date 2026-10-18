import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("Character API Test Suite", () => {
  let server;
  let baseUrl;
  let testDataDir;
  let userSeq = 0;

  const nextUser = () => `user_char_test_${++userSeq}`;

  before(async () => {
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-char-test-"));
    // Point the SQLite store at an isolated file *before* importing the app,
    // so this suite never contends with the other suites' shared database.
    process.env.DB_PATH = path.join(testDataDir, "characters.sqlite");
    process.env.DATA_PATH = path.join(testDataDir, "db.json");
    process.env.NODE_ENV = "test";

    const { createApp } = await import("../src/app.js");

    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test("GET /users/:id/characters returns an empty list for a fresh account", async () => {
    const userId = nextUser();
    const res = await fetch(`${baseUrl}/users/${userId}/characters`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.deepEqual(json.data.characters, []);
    assert.equal(json.data.maxSlots, 3);
  });

  test("POST /users/:id/characters creates a character", async () => {
    const userId = nextUser();
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tiêu Phong", gender: "nu", appearance: 2 })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.character.name, "Tiêu Phong");
    assert.equal(json.data.character.gender, "nu");
    assert.equal(json.data.character.appearance, 2);
    assert.equal(json.data.character.level, 1);
    assert.equal(json.data.character.userId, userId);
    assert.ok(json.data.character.id);

    const list = await fetch(`${baseUrl}/users/${userId}/characters`).then((r) => r.json());
    assert.equal(list.data.characters.length, 1);
    assert.equal(list.data.characters[0].gender, "nu");
  });

  test("POST defaults gender to 'nam' when omitted (400 on invalid)", async () => {
    const userId = nextUser();
    const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Vô Danh" })
    }).then((r) => r.json());
    assert.equal(created.data.character.gender, "nam");

    const bad = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sai Giới Tính", gender: "other" })
    });
    assert.equal(bad.status, 400);
  });

  test("POST rejects a duplicate character name in the same account (409)", async () => {
    const userId = nextUser();
    await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Lệnh Hồ Xung" })
    });
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "lệnh hồ xung" })
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("POST rejects a name already used by another account (global uniqueness, 409)", async () => {
    const first = await fetch(`${baseUrl}/users/${nextUser()}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tieu Phong" })
    });
    assert.equal(first.status, 201);

    const res = await fetch(`${baseUrl}/users/${nextUser()}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "tieu phong" })
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("POST rejects an invalid name (400)", async () => {
    const userId = nextUser();
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "a" })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("POST enforces the 3-slot limit (409)", async () => {
    const userId = nextUser();
    for (const name of ["Nhân Vật 1", "Nhân Vật 2", "Nhân Vật 3"]) {
      const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      assert.equal(res.status, 201);
    }
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nhân Vật 4" })
    });
    assert.equal(res.status, 409);
  });

  test("DELETE permanently removes a character and frees its name", async () => {
    const otherUser = nextUser();
    const userId = nextUser();
    const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Vô Kỵ" })
    }).then((r) => r.json());
    const { id } = created.data.character;

    const delRes = await fetch(`${baseUrl}/users/${userId}/characters/${id}`, {
      method: "DELETE"
    });
    assert.equal(delRes.status, 200);
    const delJson = await delRes.json();
    assert.deepEqual(delJson.data.characters, []);

    // The name is released and can be claimed by any account afterwards.
    const recreated = await fetch(`${baseUrl}/users/${otherUser}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Vô Kỵ" })
    });
    assert.equal(recreated.status, 201);
  });

  test("DELETE returns 404 for an unknown character", async () => {
    const userId = nextUser();
    const res = await fetch(`${baseUrl}/users/${userId}/characters/char_missing`, {
      method: "DELETE"
    });
    assert.equal(res.status, 404);
  });
});

describe("CharacterDatabase schema migration", () => {
  test("adds gender/appearance columns to a legacy table and keeps rows", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-mig-"));
    const dbPath = path.join(dir, "legacy.sqlite");

    const { DatabaseSync } = await import("node:sqlite");
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE characters (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_played INTEGER,
        deleted_at INTEGER
      );
    `);
    legacy.exec("INSERT INTO characters (id, user_id, name, level, created_at) VALUES ('c_old', 'u1', 'Cũ', 1, 123)");
    legacy.close();

    const { CharacterDatabase } = await import("../src/data/characterDb.js");
    const db = new CharacterDatabase(dbPath);

    const [row] = db.listByUser("u1");
    assert.equal(row.name, "Cũ");
    assert.equal(row.gender, "nam");
    assert.equal(row.appearance, 0);

    const created = db.create("u1", "Mới", "nu", 3);
    assert.equal(created.gender, "nu");
    assert.equal(created.appearance, 3);

    db.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("purges soft-deleted rows, renames cross-account duplicates and enforces global uniqueness", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-mig-soft-"));
    const dbPath = path.join(dir, "legacy-soft.sqlite");

    const { DatabaseSync } = await import("node:sqlite");
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE characters (
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
      CREATE UNIQUE INDEX idx_characters_user_name
        ON characters(user_id, name COLLATE NOCASE) WHERE deleted_at IS NULL;
    `);
    // Two accounts own the same name; the older row keeps it, the newer is renamed.
    legacy.exec("INSERT INTO characters (id, user_id, name, level, created_at) VALUES ('c1', 'u1', 'Trùng', 1, 100)");
    legacy.exec("INSERT INTO characters (id, user_id, name, level, created_at) VALUES ('c2', 'u2', 'Trùng', 1, 200)");
    // A soft-deleted row must be purged rather than left orphaned.
    legacy.exec("INSERT INTO characters (id, user_id, name, level, created_at, deleted_at) VALUES ('c3', 'u3', 'Đã Xoá', 1, 300, 400)");
    legacy.close();

    const { CharacterDatabase } = await import("../src/data/characterDb.js");
    const db = new CharacterDatabase(dbPath);

    assert.equal(db.listByUser("u3").length, 0, "soft-deleted row is purged");
    assert.equal(db.listByUser("u1")[0].name, "Trùng", "oldest row keeps the name");
    assert.equal(db.listByUser("u2")[0].name, "Trùng-2", "newer duplicate is renamed");

    // The global unique index is now active across accounts.
    assert.throws(() => db.create("u4", "trùng"), (err) => err.code === "NAME_TAKEN");
    // The purged name is free to use again.
    assert.equal(db.create("u3", "Đã Xoá").name, "Đã Xoá");

    db.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("dedupes cross-account names even when the deleted_at column is already gone", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-mig-nosoft-"));
    const dbPath = path.join(dir, "legacy-no-soft.sqlite");

    const { DatabaseSync } = await import("node:sqlite");
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE characters (
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
    legacy.exec("INSERT INTO characters (id, user_id, name, level, created_at) VALUES ('c1', 'u1', 'Song Sinh', 1, 100)");
    legacy.exec("INSERT INTO characters (id, user_id, name, level, created_at) VALUES ('c2', 'u2', 'Song Sinh', 1, 200)");
    legacy.close();

    const { CharacterDatabase } = await import("../src/data/characterDb.js");
    const db = new CharacterDatabase(dbPath);

    assert.equal(db.listByUser("u1")[0].name, "Song Sinh", "oldest keeps the name");
    assert.equal(db.listByUser("u2")[0].name, "Song Sinh-2", "duplicate renamed before the index is built");

    db.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
