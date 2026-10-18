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
    assert.equal(json.data.deletedCount, 0);
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

  test("POST rejects a duplicate character name (409)", async () => {
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

  test("DELETE soft-deletes a character and it can be restored", async () => {
    const userId = nextUser();
    const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Độc Cô Cầu Bại" })
    }).then((r) => r.json());
    const { id } = created.data.character;

    const delRes = await fetch(`${baseUrl}/users/${userId}/characters/${id}`, {
      method: "DELETE"
    });
    assert.equal(delRes.status, 200);
    const delJson = await delRes.json();
    assert.deepEqual(delJson.data.characters, []);
    assert.equal(delJson.data.deletedCount, 1);

    const restoreRes = await fetch(`${baseUrl}/users/${userId}/characters/restore`, {
      method: "POST"
    });
    assert.equal(restoreRes.status, 200);
    const restoreJson = await restoreRes.json();
    assert.equal(restoreJson.data.character.name, "Độc Cô Cầu Bại");
    assert.equal(restoreJson.data.characters.length, 1);
    assert.equal(restoreJson.data.deletedCount, 0);
  });

  test("POST /characters/restore returns 404 when nothing to restore", async () => {
    const userId = nextUser();
    const res = await fetch(`${baseUrl}/users/${userId}/characters/restore`, {
      method: "POST"
    });
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.success, false);
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
});
