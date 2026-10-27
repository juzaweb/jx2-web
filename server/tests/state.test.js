import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("State import API", () => {
  let server;
  let baseUrl;
  let testDataDir;
  let createSessionToken;
  let userSeq = 0;

  const nextUser = () => `user_state_test_${++userSeq}`;

  const createCharacter = async (userId, token, name) => {
    const res = await fetch(`${baseUrl}/users/${userId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, gender: "male" })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    return json.data.character.id;
  };

  before(async () => {
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-state-test-"));
    process.env.DB_PATH = path.join(testDataDir, "state.sqlite");
    process.env.NODE_ENV = "test";

    ({ createSessionToken } = await import("../src/auth/session.js"));
    const { createApp } = await import("../src/app.js");

    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
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

  test("requires an authenticated session", async () => {
    const res = await fetch(`${baseUrl}/state/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: "anything", inventory: {} })
    });
    assert.equal(res.status, 401);
  });

  test("refuses a character owned by another account", async () => {
    const ownerId = nextUser();
    const ownerToken = createSessionToken(ownerId);
    const characterId = await createCharacter(ownerId, ownerToken, "Chủ Sở Hữu");

    const intruderId = nextUser();
    const intruderToken = createSessionToken(intruderId);
    const res = await fetch(`${baseUrl}/state/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${intruderToken}` },
      body: JSON.stringify({ characterId, inventory: { "kim-sang-duoc": 5 } })
    });
    assert.equal(res.status, 403);
  });

  test("imports a legacy bag once and validates it against the catalog", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const characterId = await createCharacter(userId, token, "Nhập Trạng Thái");

    const first = await fetch(`${baseUrl}/state/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        characterId,
        inventory: {
          "kim-sang-duoc": 40,
          "nu-nhi-hong": 12,
          "khong-ton-tai": 999,
          "dai-hoan-dan": -3
        },
        equipment: { armor: "ao-lang-khach", bogus: "x", weapon: 5 }
      })
    });
    assert.equal(first.status, 200);
    const firstJson = await first.json();
    assert.equal(firstJson.imported, true);
    // The starter kit already holds 50, and the import merges by max so a legacy
    // stack can never reduce (or duplicate) what the server already granted.
    assert.equal(firstJson.data.inventory["kim-sang-duoc"], 50);
    assert.equal(firstJson.data.inventory["nu-nhi-hong"], 12);
    assert.equal(firstJson.data.inventory["khong-ton-tai"], undefined, "unknown ids are dropped");
    // A negative stack is dropped, leaving the server's starter kit untouched.
    assert.equal(firstJson.data.inventory["dai-hoan-dan"], 50);
    assert.equal(firstJson.data.equipment.armor, "ao-lang-khach");
    assert.equal(firstJson.data.equipment.bogus, undefined);

    // A second import is a no-op that reflects the canonical state.
    const second = await fetch(`${baseUrl}/state/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ characterId, inventory: { "nu-nhi-hong": 999 } })
    });
    assert.equal(second.status, 200);
    const secondJson = await second.json();
    assert.equal(secondJson.imported, false, "an import can never run twice");
    assert.equal(secondJson.data.inventory["nu-nhi-hong"], 12, "the second bag is ignored");
  });

  test("an import without gear never unequips gear the server already owns", async () => {
    const userId = nextUser();
    const token = createSessionToken(userId);
    const characterId = await createCharacter(userId, token, "Giữ Trang Bị");

    const { store } = await import("../src/data/playerDb.js");
    store.setEquipment(characterId, { armor: "ao-lang-khach" });

    const res = await fetch(`${baseUrl}/state/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ characterId, inventory: {} })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.imported, true);
    assert.equal(json.data.equipment.armor, "ao-lang-khach", "empty imported slots are ignored");
  });
});
