import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { isHostileFaction } from "../../src/game/factions.js";

let createApp;
let initGameSocket;
let gameSocket;
let adminUserId;
let BotRoster;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createTestClient = async (url) => {
  const ws = new WebSocket(url);
  const queue = [];
  const listeners = [];
  const messages = [];

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    messages.push(msg);
    for (let i = 0; i < listeners.length; i += 1) {
      if (listeners[i].predicate(msg)) {
        const listener = listeners.splice(i, 1)[0];
        clearTimeout(listener.timer);
        listener.resolve(msg);
        return;
      }
    }
    queue.push(msg);
  });

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  return {
    ws,
    messages,
    send: (data) => ws.send(JSON.stringify(data)),
    waitFor: (predicate, timeoutMs = 4000) => {
      for (let i = 0; i < queue.length; i += 1) {
        if (predicate(queue[i])) return Promise.resolve(queue.splice(i, 1)[0]);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = listeners.findIndex((listener) => listener.timer === timer);
          if (index !== -1) listeners.splice(index, 1);
          reject(new Error(`Timed out waiting for message after ${timeoutMs}ms`));
        }, timeoutMs);
        listeners.push({ predicate, resolve, timer });
      });
    },
    close: () =>
      new Promise((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) return resolve();
        ws.on("close", resolve);
        ws.close();
      })
  };
};

const join = (client, payload) => {
  client.send({ type: "player_join", payload });
  return client.waitFor((message) => message.type === "init_world" || message.type === "join_rejected");
};

test("server-authoritative PK bots", async (t) => {
  let server;
  let port;
  let testDataDir;

  t.after(async () => {
    if (gameSocket) gameSocket.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (testDataDir) await fs.rm(testDataDir, { recursive: true, force: true });
  });

  await t.test("Setup bot-enabled server", async () => {
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-bot-test-"));
    process.env.DB_PATH = path.join(testDataDir, "bots.sqlite");
    process.env.NODE_ENV = "test";

    ({ createApp } = await import("../src/app.js"));
    ({ initGameSocket } = await import("../src/websocket/gameSocket.js"));
    ({ BotRoster } = await import("../src/game/botRoster.js"));
    const { userDb } = await import("../src/data/userDb.js");
    adminUserId = (await userDb.register("admin_bot_test", "123456", "Bot Admin", "admin")).id;

    server = http.createServer(createApp());
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;

    gameSocket = initGameSocket(server, {
      path: "/ws",
      bots: true,
      botCount: 1,
      botAggroRange: 3000,
      botTickMs: 30,
      botRespawnMs: 150,
      enemies: false,
      random: () => 0.5,
      verifyToken: (token) => {
        if (token === "test-token") return "bot_user";
        if (token === "admin-token") return adminUserId;
        return null;
      },
      ownsCharacter: () => true,
      findCharacter: (_userId, characterId) => ({
        id: characterId,
        name: characterId,
        faction: "han",
        gender: "male"
      })
    });
  });

  await t.test("joining a battlefield spawns an enemy bot into init_world", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const init = await join(client, {
      token: "test-token",
      characterId: "char_bot_player",
      mapId: "trung-nguyen",
      x: 6000,
      y: 6000
    });
    assert.equal(init.type, "init_world");
    assert.equal(init.payload.mapId, "trung-nguyen");

    const bot = init.payload.players.find((player) => player.id?.startsWith("bot-"));
    assert.ok(bot, "the bot is part of the initial peer roster");
    assert.equal(bot.pkFlag, true);
    assert.ok(isHostileFaction(bot.faction, "han"));

    await client.close();
  });

  await t.test("a bot chases and strikes a hostile player", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const init = await join(client, {
      token: "test-token",
      characterId: "char_bot_fight",
      mapId: "trung-nguyen",
      x: 6000,
      y: 6000
    });
    const botId = init.payload.players.find((player) => player.id?.startsWith("bot-"))?.id;
    assert.ok(botId);

    const serverBot = gameSocket.bots.get(botId);
    serverBot.faction = "thuc";
    serverBot.x = 6300;
    serverBot.y = 6000;
    serverBot.nextAttackAt = 0;

    const hp = await client.waitFor(
      (message) =>
        message.type === "player_hp" &&
        message.payload.id === "char_bot_fight" &&
        message.payload.source === "pvp",
      6000
    );
    assert.ok(hp.payload.damage > 0, "the bot deals server-computed damage");

    await client.close();
  });

  await t.test("a player can damage and defeat a bot without earning rewards", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const init = await join(client, {
      token: "test-token",
      characterId: "char_bot_hitter",
      mapId: "trung-nguyen",
      x: 6000,
      y: 6000
    });
    const botId = init.payload.players.find((player) => player.id?.startsWith("bot-"))?.id;
    assert.ok(botId);
    const progressBefore = gameSocket.playerById.get("char_bot_hitter")?.data.progress;
    const expBefore = progressBefore.exp;
    const coinsBefore = progressBefore.coins;

    const serverBot = gameSocket.bots.get(botId);
    serverBot.x = 6100;
    serverBot.y = 6000;
    serverBot.hp = 5;
    serverBot.faction = "thuc";
    serverBot.nextAttackAt = Date.now() + 5000;

    await sleep(340);
    client.send({
      type: "player_attack",
      payload: { skill: "kiem_khi", x: 6100, y: 6000, facingRight: true }
    });
    client.send({ type: "player_hit", payload: { targetId: botId, skill: "kiem_khi" } });

    const left = await client.waitFor(
      (message) => message.type === "player_left" && message.payload.id === botId,
      4000
    );
    assert.equal(left.payload.id, botId);
    assert.equal(serverBot.isDead, true);
    const progressAfter = gameSocket.playerById.get("char_bot_hitter")?.data.progress;
    assert.equal(progressAfter.exp, expBefore, "killing a bot pays no EXP");
    assert.equal(progressAfter.coins, coinsBefore, "killing a bot pays no coins");

    const respawned = await client.waitFor(
      (message) => message.type === "player_joined" && message.payload.player.id === botId,
      4000
    );
    assert.equal(respawned.payload.player.hp, respawned.payload.player.maxHp);

    await client.close();
  });

  await t.test("a faction battlefield always spawns an enemy for the joining camp", () => {
    const game = { players: new Map(), broadcastToMap: () => {} };
    const roster = new BotRoster(game, { bots: true, botCount: 1, botLevel: 30 });

    roster.ensureBotsForMap("trung-nguyen", null, "thuc");

    const bots = roster.botsOnMap("trung-nguyen");
    assert.equal(bots.length, 1);
    assert.ok(
      isHostileFaction(bots[0].faction, "thuc"),
      "the lone bot must not be an ally of the joining player"
    );
    roster.close();
  });

  await t.test("GM cannot spawn bots inside a safe city", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const init = await join(client, {
      token: "admin-token",
      characterId: "char_bot_safe_city",
      mapId: "market",
      x: 5000,
      y: 5000
    });
    assert.equal(init.type, "init_world");
    assert.equal(init.payload.mapId, "market");

    client.send({ type: "gm_action", payload: { action: "spawn_bots", count: 1 } });
    const refusal = await client.waitFor(
      (message) =>
        message.type === "player_chat" &&
        message.payload.sender === "Hệ Thống" &&
        message.payload.text.includes("an toàn")
    );
    assert.ok(refusal);
    assert.equal(gameSocket.botsOnMap("market").length, 0);

    await client.close();
  });

  await t.test("a bot that stops moving clears its velocity so it cannot fake a dodge", () => {
    const player = {
      id: "char_dodge_probe",
      mapId: "trung-nguyen",
      faction: "thuc",
      x: 6100,
      y: 6000,
      hp: 100,
      pkFlag: true
    };
    const game = {
      players: new Map([["probe-ws", player]]),
      broadcastToMap: () => {},
      effectiveStats: () => ({
        maxHp: 680,
        maxMp: 300,
        attack: 30,
        defense: 6,
        critRate: 0,
        critDamage: 1.5,
        attackSpeed: 1
      }),
      pvpModeFor: () => "faction",
      canFightHere: () => true,
      random: () => 0.5
    };
    const roster = new BotRoster(game, { bots: true, botCount: 1, botLevel: 30 });
    const bot = roster.spawnBot({
      mapId: "trung-nguyen",
      x: 6000,
      y: 6000,
      faction: "han"
    });
    bot.nextAttackAt = Infinity;
    bot.vx = 500;
    bot.vy = 0;

    roster.tickBots();

    assert.equal(bot.vx, 0);
    assert.equal(bot.vy, 0);
    roster.close();
  });

  await t.test("monsters chase bots with the same AI they use on players", () => {
    const manager = Object.create(Object.getPrototypeOf(gameSocket));
    const enemy = {
      id: 1,
      mapId: "dong-mon-thanh",
      x: 1000,
      y: 1000,
      homeX: 1000,
      homeY: 1000,
      hp: 100,
      maxHp: 100,
      attack: 12,
      defense: 3,
      isDead: false,
      tuning: null
    };
    const bot = { id: "bot-monster-target", mapId: "dong-mon-thanh", x: 1400, y: 1000 };
    const broadcasts = [];

    Object.assign(manager, {
      wss: { clients: { size: 1 } },
      enemyTickMs: 100,
      players: new Map(),
      enemyByMap: new Map([["dong-mon-thanh", new Map([[enemy.id, enemy]])]]),
      botRoster: {
        botsOnMap: (mapId) => (mapId === "dong-mon-thanh" ? [bot] : [])
      },
      gridFor: () => ({ update() {}, getNear: () => [] }),
      broadcastToMap: (mapId, message) => broadcasts.push({ mapId, message })
    });

    manager.tickEnemies();

    assert.ok(enemy.x > 1000, "the wolf steps toward the bot");
    const moved = broadcasts.find((entry) => entry.message.type === "enemy_moved");
    assert.ok(moved, "the server broadcasts the wolf's move");
  });

  await t.test("GM can spawn and clear bots on the current map", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const init = await join(client, {
      token: "admin-token",
      characterId: "char_bot_admin",
      mapId: "trung-nguyen",
      x: 6000,
      y: 6000
    });
    assert.equal(init.type, "init_world");
    const before = gameSocket.botsOnMap("trung-nguyen").length;

    client.send({ type: "gm_action", payload: { action: "spawn_bots", count: 2 } });
    await client.waitFor(
      (message) =>
        message.type === "player_chat" &&
        message.payload.sender === "Hệ Thống" &&
        message.payload.text.includes("2 bot")
    );
    assert.equal(gameSocket.botsOnMap("trung-nguyen").length, before + 2);

    client.send({ type: "gm_action", payload: { action: "clear_bots" } });
    await client.waitFor(
      (message) =>
        message.type === "player_chat" &&
        message.payload.sender === "Hệ Thống" &&
        message.payload.text.includes("xóa")
    );
    assert.equal(gameSocket.botsOnMap("trung-nguyen").length, 0);

    await client.close();
  });
});
