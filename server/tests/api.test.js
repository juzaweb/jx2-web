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

  test("Inventory REST is read-only and authenticated", async () => {
    // The bag is written only over the WebSocket now, so the old PUT is gone.
    const putRes = await fetch(`${baseUrl}/inventory/player_test_01`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventory: { potion_hp: 20 } })
    });
    assert.equal(putRes.status, 404);

    // Reading a bag requires a verified session token.
    const getRes = await fetch(`${baseUrl}/inventory/player_test_01`);
    assert.equal(getRes.status, 401);
    const getJson = await getRes.json();
    assert.equal(getJson.success, false);
  });

  test("State import is the only bag write path and requires authentication", async () => {
    const res = await fetch(`${baseUrl}/state/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: "char_x", inventory: { potion_hp: -5 } })
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test("Users: Profile access requires authentication and ownership", async () => {
    // 1. Unauthenticated request must return 401
    const unauthRes = await fetch(`${baseUrl}/users/me`);
    assert.equal(unauthRes.status, 401);

    // Login to get a valid token
    const loginRes = await fetch(`${baseUrl}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "hiepkhat99", password: "secretpassword123" })
    });
    const { token, user } = (await loginRes.json()).data;

    // 2. Requesting own profile with valid token must succeed
    const ownProfileRes = await fetch(`${baseUrl}/users/me?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(ownProfileRes.status, 200);
    const ownJson = await ownProfileRes.json();
    assert.equal(ownJson.success, true);
    assert.equal(ownJson.data.user.id, user.id);

    // 3. Requesting another user's profile with valid token must return 403
    const foreignRes = await fetch(`${baseUrl}/users/me?userId=user_other_id_123`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(foreignRes.status, 403);
    const foreignJson = await foreignRes.json();
    assert.equal(foreignJson.success, false);
  });

  test("Leaderboard reads from persisted saves", async () => {
    const lbRes = await fetch(`${baseUrl}/leaderboard?sortBy=level&limit=5`);
    assert.equal(lbRes.status, 200);
    const lbJson = await lbRes.json();
    assert.equal(lbJson.success, true);
    assert.ok(Array.isArray(lbJson.data.rankings));
  });

  test("Validation: rejects invalid playerId", async () => {
    // requireAuth runs before the id validator, so an anonymous request is 401.
    const res = await fetch(`${baseUrl}/inventory/invalid@id!`);
    assert.equal(res.status, 401);
  });

  test("Validation: legacy inventory writes cannot pollute prototypes", async () => {
    const evilPayload = JSON.parse('{"__proto__": {"admin": true}, "inventory": {"potion_hp": 3}}');
    const res = await fetch(`${baseUrl}/inventory/safe_player`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evilPayload)
    });
    assert.equal(res.status, 404);
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
