import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("Giang Ho Backend API Test Suite", () => {
  let server;
  let baseUrl;
  let testDataDir;
  let userDb;

  before(async () => {
    // Setup temporary test data directory and point every store at it BEFORE the
    // app modules load, so tests never write to the development database.
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-test-"));
    process.env.DB_PATH = path.join(testDataDir, "test-users.sqlite");
    process.env.NODE_ENV = "test";

    const { createApp } = await import("../src/app.js");
    ({ userDb } = await import("../src/data/userDb.js"));

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
    if (server && server.closeAllConnections) server.closeAllConnections();
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

  test("CORS: allows configured origins and handles wildcards safely", async () => {
    const { config } = await import("../src/config.js");
    const { createApp } = await import("../src/app.js");

    const prevOrigin = config.clientOrigin;
    const prevEnv = config.env;

    let customServer;
    let prodServer;

    try {
      // Test 1: Explicit allowed origin list
      config.clientOrigin = "http://example.com, https://app.example.com";
      const customApp = createApp();
      await new Promise((resolve) => {
        customServer = customApp.listen(0, "127.0.0.1", resolve);
      });
      const port = customServer.address().port;
      const customUrl = `http://127.0.0.1:${port}/api/health`;

      // Request from allowed origin
      const allowedRes = await fetch(customUrl, {
        headers: { Origin: "http://example.com" }
      });
      assert.equal(allowedRes.headers.get("access-control-allow-origin"), "http://example.com");
      assert.equal(allowedRes.headers.get("access-control-allow-credentials"), "true");

      // Request from disallowed origin
      const disallowedRes = await fetch(customUrl, {
        headers: { Origin: "http://untrusted-origin.com" }
      });
      assert.equal(disallowedRes.headers.get("access-control-allow-origin"), null);

      // Test 2: Wildcard origin in production mode forbids arbitrary reflection
      config.clientOrigin = "*";
      config.env = "production";
      const prodApp = createApp();
      await new Promise((resolve) => {
        prodServer = prodApp.listen(0, "127.0.0.1", resolve);
      });
      const prodPort = prodServer.address().port;
      const prodUrl = `http://127.0.0.1:${prodPort}/api/health`;

      const prodRes = await fetch(prodUrl, {
        headers: { Origin: "http://untrusted-origin.com" }
      });
      assert.equal(prodRes.headers.get("access-control-allow-origin"), null);
    } finally {
      if (customServer) {
        if (customServer.closeAllConnections) customServer.closeAllConnections();
        await new Promise((resolve) => customServer.close(resolve));
      }
      if (prodServer) {
        if (prodServer.closeAllConnections) prodServer.closeAllConnections();
        await new Promise((resolve) => prodServer.close(resolve));
      }
      config.clientOrigin = prevOrigin;
      config.env = prevEnv;
    }
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

  test("Validation: rejects invalid playerId", async () => {
    const res = await fetch(`${baseUrl}/inventory/invalid@id!`);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("Validation: prevents prototype pollution attacks", async () => {
    const evilPayload = JSON.parse('{"__proto__": {"admin": true}, "inventory": {"potion_hp": 3}}');
    const res = await fetch(`${baseUrl}/inventory/safe_player`, {
      method: "PUT",
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

  test("Users: renaming display_name propagates to the leaderboard", async () => {
    const registerRes = await fetch(`${baseUrl}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "theanh",
        password: "secretpassword123",
        displayName: "theanh"
      })
    });
    assert.equal(registerRes.status, 201);
    const registerJson = await registerRes.json();
    const userId = registerJson.data.user.id;

    const firstSubmit = await fetch(`${baseUrl}/leaderboard/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: userId, playerName: "theanh", level: 12, kills: 4, coins: 30, exp: 200 })
    });
    const firstJson = await firstSubmit.json();
    assert.equal(firstJson.data.playerName, "theanh");

    // Simulate an out-of-band rename straight in the users table
    userDb.db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run("Hiệp Khách Vô Danh", userId);

    await fetch(`${baseUrl}/leaderboard/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: userId, playerName: "theanh", level: 13, kills: 5, coins: 40, exp: 260 })
    });

    const lbRes = await fetch(`${baseUrl}/leaderboard?sortBy=level&limit=50`);
    const lbJson = await lbRes.json();
    const entry = lbJson.data.rankings.find((r) => r.playerId === userId);
    assert.ok(entry, "Renamed player should appear in the leaderboard");
    assert.equal(entry.playerName, "Hiệp Khách Vô Danh");
    assert.equal(entry.level, 13);
  });

  test("Leaderboard: submit uses the registered display name over the payload name", async () => {
    const registerRes = await fetch(`${baseUrl}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "bx_hiep_si",
        password: "secretpassword123",
        displayName: "Bạch Y Hiệp Sĩ"
      })
    });
    const registerJson = await registerRes.json();
    const userId = registerJson.data.user.id;

    const submitRes = await fetch(`${baseUrl}/leaderboard/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: userId,
        playerName: "Tên Giả",
        level: 42,
        kills: 120,
        coins: 5000,
        exp: 21000
      })
    });
    assert.equal(submitRes.status, 200);
    const submitJson = await submitRes.json();
    assert.equal(submitJson.data.playerName, "Bạch Y Hiệp Sĩ");
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

  test("Users: Check username availability returns status and reason", async () => {
    // Taken username (hiepkhat99 was registered in previous test)
    const takenRes = await fetch(`${baseUrl}/users/check-username?username=hiepkhat99`);
    assert.equal(takenRes.status, 200);
    const takenJson = await takenRes.json();
    assert.equal(takenJson.success, true);
    assert.equal(takenJson.data.available, false);

    // Available username
    const availRes = await fetch(`${baseUrl}/users/check-username?username=brand_new_hero_123`);
    assert.equal(availRes.status, 200);
    const availJson = await availRes.json();
    assert.equal(availJson.success, true);
    assert.equal(availJson.data.available, true);

    // Invalid format username
    const invalidRes = await fetch(`${baseUrl}/users/check-username?username=a!b`);
    assert.equal(invalidRes.status, 200);
    const invalidJson = await invalidRes.json();
    assert.equal(invalidJson.data.available, false);
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

    // Password too long (> 128 chars)
    const res3 = await fetch(`${baseUrl}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "longpassuser", password: "a".repeat(130) })
    });
    assert.equal(res3.status, 400);
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

  test("Concurrency: handles concurrent inventory updates without corruption", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      fetch(`${baseUrl}/inventory/concurrent_player_${i}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory: { potion_hp: i + 1 } })
      })
    );

    const responses = await Promise.all(promises);
    for (const res of responses) {
      assert.equal(res.status, 200);
    }

    // Verify all 10 inventories are intact
    for (let i = 0; i < 10; i++) {
      const getRes = await fetch(`${baseUrl}/inventory/concurrent_player_${i}`);
      assert.equal(getRes.status, 200);
      const json = await getRes.json();
      assert.equal(json.data.inventory.potion_hp, i + 1);
    }
  });

  test("Error handling: masks 500 error messages in production environment", async () => {
    const { errorHandler } = await import("../src/middlewares/errorHandler.js");

    const internalErr = new Error("Sensitive internal database connection failed: sqlite /secret/path");

    let responseStatus;
    let responseJson;
    const req = { method: "GET", originalUrl: "/api/test" };
    const res = {
      headersSent: false,
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      }
    };

    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      errorHandler(internalErr, req, res, () => {});

      assert.equal(responseStatus, 500);
      assert.equal(responseJson.success, false);
      assert.equal(responseJson.error, "Đã xảy ra lỗi máy chủ nội bộ");
      assert.equal(responseJson.stack, undefined);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});
