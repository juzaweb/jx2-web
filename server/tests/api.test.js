import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createApp } from "../src/app.js";
import { userDb } from "../src/data/userDb.js";

describe("Giang Ho Backend API Test Suite", () => {
  let server;
  let baseUrl;
  let testDataDir;

  before(async () => {
    // Setup temporary test data directory
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-test-"));
    process.env.DATA_PATH = path.join(testDataDir, "test-db.json");
    process.env.NODE_ENV = "test";

    // Clean user table for test isolation
    userDb.clear();

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

  test("GET /api/health returns ok status and security header is sanitized", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, "ok");
    assert.equal(json.service, "jx2-backend");
    assert.equal(typeof json.uptime, "number");
    // Verify X-Powered-By is omitted
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  test("GET /api/save/unknown_user returns 404", async () => {
    const res = await fetch(`${baseUrl}/save/unknown_user_999`);
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("POST /api/save/:playerId saves player progress and syncs to leaderboard", async () => {
    const payload = {
      playerName: "Kiếm Khách Vô Danh",
      stats: {
        level: 25,
        hp: 450,
        mp: 300,
        exp: 15400,
        coins: 8800,
        kills: 66
      },
      position: { x: 120, y: 340 },
      questRewarded: true,
      audioEnabled: true,
      inventory: {
        potion_hp: 15,
        potion_mp: 8
      }
    };

    const saveRes = await fetch(`${baseUrl}/save/player_test_01`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    assert.equal(saveRes.status, 200);
    const saveJson = await saveRes.json();
    assert.equal(saveJson.success, true);
    assert.equal(saveJson.data.stats.level, 25);
    assert.equal(saveJson.data.inventory.potion_hp, 15);

    // Verify GET retrieves saved data
    const getRes = await fetch(`${baseUrl}/save/player_test_01`);
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.equal(getJson.success, true);
    assert.equal(getJson.data.playerName, "Kiếm Khách Vô Danh");
    assert.equal(getJson.data.stats.level, 25);
    assert.equal(getJson.data.position.x, 120);

    // Verify player is now in leaderboard
    const lbRes = await fetch(`${baseUrl}/leaderboard?sortBy=level&limit=10`);
    assert.equal(lbRes.status, 200);
    const lbJson = await lbRes.json();
    assert.equal(lbJson.success, true);
    const found = lbJson.data.rankings.find((r) => r.playerId === "player_test_01");
    assert.ok(found, "Player should appear in leaderboard");
    assert.equal(found.level, 25);
    assert.equal(found.kills, 66);
  });

  test("Inventory endpoints: GET and PUT", async () => {
    // Update inventory
    const putRes = await fetch(`${baseUrl}/inventory/player_test_01`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventory: {
          potion_hp: 20,
          potion_mp: 12,
          scroll_teleport: 2
        }
      })
    });

    assert.equal(putRes.status, 200);
    const putJson = await putRes.json();
    assert.equal(putJson.success, true);
    assert.equal(putJson.data.inventory.scroll_teleport, 2);

    // Retrieve inventory
    const getRes = await fetch(`${baseUrl}/inventory/player_test_01`);
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.equal(getJson.data.inventory.potion_hp, 20);
    assert.equal(getJson.data.inventory.scroll_teleport, 2);
  });

  test("Inventory validation: rejects negative quantities", async () => {
    const res = await fetch(`${baseUrl}/inventory/player_test_01`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventory: {
          potion_hp: -5
        }
      })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("Leaderboard: Submit score and sort options", async () => {
    const submitRes = await fetch(`${baseUrl}/leaderboard/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: "master_swordsman",
        playerName: "Tây Môn Xuy Tuyết",
        level: 60,
        kills: 500,
        coins: 200000,
        exp: 300000
      })
    });

    assert.equal(submitRes.status, 200);
    const submitJson = await submitRes.json();
    assert.equal(submitJson.success, true);

    // Check sorted by level
    const lbRes = await fetch(`${baseUrl}/leaderboard?sortBy=level&limit=5`);
    const lbJson = await lbRes.json();
    assert.equal(lbJson.data.rankings[0].playerName, "Tây Môn Xuy Tuyết");
    assert.equal(lbJson.data.rankings[0].level, 60);

    // Check sorted by kills
    const killLbRes = await fetch(`${baseUrl}/leaderboard?sortBy=kills&limit=5`);
    const killLbJson = await killLbRes.json();
    assert.equal(killLbJson.data.rankings[0].kills, 500);
  });

  test("Leaderboard validation: rejects negative stats", async () => {
    const res = await fetch(`${baseUrl}/leaderboard/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: "bad_player",
        level: -10
      })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("DELETE /api/save/:playerId removes player", async () => {
    const delRes = await fetch(`${baseUrl}/save/player_test_01`, {
      method: "DELETE"
    });
    assert.equal(delRes.status, 200);

    // Now GET should return 404
    const getRes = await fetch(`${baseUrl}/save/player_test_01`);
    assert.equal(getRes.status, 404);
  });

  test("Validation: rejects invalid playerId", async () => {
    const res = await fetch(`${baseUrl}/save/invalid@id!`);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("Validation: prevents prototype pollution attacks", async () => {
    const evilPayload = JSON.parse('{"__proto__": {"admin": true}, "stats": {"level": 10}}');
    const res = await fetch(`${baseUrl}/save/safe_player`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evilPayload)
    });
    assert.equal(res.status, 200);
    assert.equal(({}).admin, undefined, "Prototype pollution must be neutralized");
  });

  test("Users: Register a new user successfully", async () => {
    const res = await fetch(`${baseUrl}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "hiepkhat99",
        password: "secretpassword123",
        displayName: "Hiệp Khách Vô Danh"
      })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user.username, "hiepkhat99");
    assert.equal(json.data.user.displayName, "Hiệp Khách Vô Danh");
    assert.ok(json.data.user.id);
    assert.ok(json.data.token);
    // Ensure password_hash and salt are not exposed in response
    assert.equal(json.data.user.password_hash, undefined);
    assert.equal(json.data.user.salt, undefined);
  });

  test("Users: Register rejects duplicate username", async () => {
    const res = await fetch(`${baseUrl}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "hiepkhat99",
        password: "anotherpassword456"
      })
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("Users: Register validates username and password requirements", async () => {
    // Short password
    const res1 = await fetch(`${baseUrl}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "validuser", password: "123" })
    });
    assert.equal(res1.status, 400);

    // Invalid username with spaces or special chars
    const res2 = await fetch(`${baseUrl}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bad user!", password: "validpassword" })
    });
    assert.equal(res2.status, 400);
  });

  test("Users: Login with valid credentials succeeds", async () => {
    const res = await fetch(`${baseUrl}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "hiepkhat99",
        password: "secretpassword123"
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user.username, "hiepkhat99");
    assert.ok(json.data.user.lastLogin);
    assert.ok(json.data.token);
  });

  test("Users: Login with incorrect password fails", async () => {
    const res = await fetch(`${baseUrl}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "hiepkhat99",
        password: "wrongpassword"
      })
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("Users: Login with non-existent user fails", async () => {
    const res = await fetch(`${baseUrl}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "ghost_user_not_exist",
        password: "anypassword"
      })
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("Concurrency: handles concurrent saves without race conditions or file corruption", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      fetch(`${baseUrl}/save/concurrent_player_${i}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: `Chiến Tướng ${i}`,
          stats: { level: i + 1, kills: i * 5 }
        })
      })
    );

    const responses = await Promise.all(promises);
    for (const res of responses) {
      assert.equal(res.status, 200);
    }

    // Verify all 10 saves are intact
    for (let i = 0; i < 10; i++) {
      const getRes = await fetch(`${baseUrl}/save/concurrent_player_${i}`);
      assert.equal(getRes.status, 200);
      const json = await getRes.json();
      assert.equal(json.data.stats.level, i + 1);
    }
  });
});
