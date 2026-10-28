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
  let createSessionToken;

  const nextUser = () => `user_char_test_${++userSeq}`;

  before(async () => {
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-char-test-"));
    // Point the SQLite store at an isolated file *before* importing the app,
    // so this suite never contends with the other suites' shared database.
    process.env.DB_PATH = path.join(testDataDir, "characters.sqlite");
    process.env.NODE_ENV = "test";

    const sessionModule = await import("../src/auth/session.js");
    createSessionToken = sessionModule.createSessionToken;

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

  test("GET /users/:id/characters returns 401 when unauthenticated", async () => {
    const userId = nextUser();
    const res = await fetch(`${baseUrl}/users/${userId}/characters`);
    assert.equal(res.status, 401);
  });

  test("GET /users/:id/characters returns 403 when trying to access another user's characters", async () => {
    const userId = nextUser();
    const otherUser = nextUser();
    const token = createSessionToken(otherUser);
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(res.status, 403);
  });

  test("GET /users/:id/characters returns an empty list for a fresh account", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.deepEqual(json.data.characters, []);
    assert.equal(json.data.maxSlots, 3);
  });

  test("POST /users/:id/characters creates a character", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Tiêu Phong", gender: "female" })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.character.name, "Tiêu Phong");
    assert.equal(json.data.character.gender, "female");
    assert.equal(json.data.character.level, 1);
    assert.equal(json.data.character.userId, userId);
    assert.ok(json.data.character.id);

    const list = await fetch(`${baseUrl}/users/${userId}/characters`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((r) => r.json());
    assert.equal(list.data.characters.length, 1);
    assert.equal(list.data.characters[0].gender, "female");
  });

  test("POST /users/:id/characters stores the chosen faction", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Thục Tướng", faction: "thuc" })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.data.character.faction, "thuc");
  });

  test("POST /users/:id/characters rejects an unknown faction", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Vô Phe", faction: "unknown" })
    });
    assert.equal(res.status, 400);
  });

  test("a new character starts with the shared starter kit", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Tân Thủ" })
    }).then((r) => r.json());

    const bag = await fetch(
      `${baseUrl}/inventory/${created.data.character.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then((r) => r.json());

    // The starter sword is equipped at creation, so only consumables remain in the bag.
    assert.deepEqual(bag.data.inventory, {
      "kim-sang-duoc": 50,
      "dai-hoan-dan": 50,
      "hoi-thanh-phu": 50
    });
  });

  test("an admin account receives the GM item in the starter kit", async () => {
    const { userDb } = await import("../src/data/userDb.js");
    const adminUser = userDb.register("admin_char_test", "123456", "AdminChar", "admin");
    const token = createSessionToken(adminUser.id);

    const created = await fetch(`${baseUrl}/users/${adminUser.id}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "AdminHero" })
    }).then((r) => r.json());

    const bag = await fetch(
      `${baseUrl}/inventory/${created.data.character.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then((r) => r.json());

    assert.equal(bag.data.inventory["lenh-bai-gm"], 1);
    assert.equal(bag.data.inventory["kim-sang-duoc"], 50);
  });

  test("test mode grants the test token to every character and revokes it afterwards", async () => {
    process.env.TEST_MODE = "true";
    const userId = nextUser();
    const token = createSessionToken(userId);
    let characterId;
    try {
      const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: "Kiểm Thử" })
      }).then((r) => r.json());
      characterId = created.data.character.id;

      const bag = await fetch(`${baseUrl}/inventory/${characterId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((r) => r.json());

      assert.equal(bag.data.inventory["lenh-bai-test"], 1);
      assert.equal(bag.data.inventory["lenh-bai-gm"], undefined);
      assert.equal(bag.data.inventory["kim-sang-duoc"], 50);
    } finally {
      delete process.env.TEST_MODE;
    }

    // Outside test mode the token is stripped, so it never lingers in the bag.
    const after = await fetch(`${baseUrl}/inventory/${characterId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((r) => r.json());
    assert.equal(after.data.inventory["lenh-bai-test"], undefined);
  });

  test("the starter kit is never granted twice and never replaces a played bag", async () => {
    const { store } = await import("../src/data/playerDb.js");
    const userId = nextUser();
    const token = createSessionToken(userId);
    const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Lão Luyện", gender: "male" })
    }).then((r) => r.json());
    const characterId = created.data.character.id;

    // Simulate a character that has spent most of the kit.
    await store.setInventory(characterId, { "kim-sang-duoc": 2 });

    store.grantStarterItems(characterId);

    const bag = await fetch(`${baseUrl}/inventory/${characterId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((r) => r.json());
    assert.deepEqual(bag.data.inventory, { "kim-sang-duoc": 2 });
  });

  test("POST defaults to male when gender is omitted", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Vô Danh" })
    }).then((r) => r.json());
    assert.equal(created.data.character.gender, "male");
  });

  test("POST persists the chosen gender (unknown values fall back to male)", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Độc Cô", gender: "male" })
    });
    assert.equal(created.status, 201);
    const json = await created.json();
    assert.equal(json.data.character.gender, "male");

    const female = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Nữ Hiệp", gender: "female" })
    }).then((r) => r.json());
    assert.equal(female.data.character.gender, "female");

    const bad = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Sai Giới Tính", gender: "bogus" })
    }).then((r) => r.json());
    assert.equal(bad.data.character.gender, "male");
  });

  test("POST rejects a duplicate character name in the same account (409)", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Lệnh Hồ Xung" })
    });
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "lệnh hồ xung" })
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("POST rejects a name already used by another account (global uniqueness, 409)", async () => {
    const user1 = nextUser();
    const token1 = createSessionToken(user1);
    const first = await fetch(`${baseUrl}/users/${user1}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({ name: "Tieu Phong" })
    });
    assert.equal(first.status, 201);

    const user2 = nextUser();
    const token2 = createSessionToken(user2);
    const res = await fetch(`${baseUrl}/users/${user2}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token2}`
      },
      body: JSON.stringify({ name: "tieu phong" })
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("POST rejects an invalid name (400)", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "a" })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("POST enforces the 3-slot limit (409)", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    for (const name of ["Nhân Vật 1", "Nhân Vật 2", "Nhân Vật 3"]) {
      const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      assert.equal(res.status, 201);
    }
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Nhân Vật 4" })
    });
    assert.equal(res.status, 409);
  });

  test("DELETE permanently removes a character and frees its name", async () => {
    const otherUser = nextUser();
    const otherToken = createSessionToken(otherUser);
    const userId = nextUser();
    const token = createSessionToken(userId);

    const created = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: "Vô Kỵ" })
    }).then((r) => r.json());
    const { id } = created.data.character;

    const delRes = await fetch(`${baseUrl}/users/${userId}/characters/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(delRes.status, 200);
    const delJson = await delRes.json();
    assert.deepEqual(delJson.data.characters, []);

    // The name is released and can be claimed by any account afterwards.
    const recreated = await fetch(`${baseUrl}/users/${otherUser}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherToken}`
      },
      body: JSON.stringify({ name: "Vô Kỵ" })
    });
    assert.equal(recreated.status, 201);
  });

  test("DELETE returns 404 for an unknown character", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const res = await fetch(`${baseUrl}/users/${userId}/characters/char_missing`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
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
    assert.equal(row.gender, "male");
    assert.equal(row.appearance, 0);

    const created = db.create("u1", "Mới", "female");
    assert.equal(created.gender, "female");

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
    // Legacy female rows belong to Nga My once the sect column is added.
    legacy.exec("INSERT INTO characters (id, user_id, name, gender, level, created_at) VALUES ('c4', 'u4', 'Nữ Cũ', 'nu', 1, 400)");
    legacy.close();

    const { CharacterDatabase } = await import("../src/data/characterDb.js");
    const db = new CharacterDatabase(dbPath);

    assert.equal(db.listByUser("u3").length, 0, "soft-deleted row is purged");
    assert.equal(db.listByUser("u4")[0].gender, "female");
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
