import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { MARKET_NPCS } from "../../src/game/marketLayout.js";
import { DEFAULT_MAP_ID, MAP_IDS, getMap } from "../../src/game/maps/mapRegistry.js";

// Assigned in the setup subtest, after DB_PATH points at a throwaway file (the
// server-side modules open their SQLite database at import time).
let createApp;
let initGameSocket;
let ENEMY_MAX_HP;
let store;
let userDb;
let adminUserId;
let gameSocket;

/** Small client wrapper: queues messages and resolves predicates. */
const createTestClient = async (url) => {
  const ws = new WebSocket(url);
  const queue = [];
  const listeners = [];
  const messages = [];

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i].predicate(msg)) {
          const listener = listeners.splice(i, 1)[0];
          clearTimeout(listener.timer);
          return listener.resolve(msg);
        }
      }
      queue.push(msg);
    } catch {
      // ignore malformed frames
    }
  });

  await new Promise((res, rej) => {
    ws.on("open", res);
    ws.on("error", rej);
  });

  return {
    ws,
    messages,
    send: (data) => ws.send(JSON.stringify(data)),
    waitFor: (predicate, timeoutMs = 2500) => {
      for (let i = 0; i < queue.length; i++) {
        if (predicate(queue[i])) return Promise.resolve(queue.splice(i, 1)[0]);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = listeners.findIndex((l) => l.timer === timer);
          if (idx !== -1) listeners.splice(idx, 1);
          reject(new Error(`Timed out waiting for message after ${timeoutMs}ms`));
        }, timeoutMs);
        listeners.push({ predicate, resolve, timer });
      });
    },
    /** Wait `ms` and then report how many queued messages match. */
    count: (predicate) => messages.filter(predicate).length,
    close: () =>
      new Promise((res) => {
        if (ws.readyState === WebSocket.CLOSED) return res();
        ws.on("close", res);
        ws.close();
      })
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Send an authenticated join and wait for init_world / join_rejected. */
const join = async (client, { characterId, token = "test-token", x = 5000, y = 5000, extra = {} }) => {
  client.send({
    type: "player_join",
    payload: { token, characterId, x, y, ...extra }
  });
  return client.waitFor((m) => m.type === "init_world" || m.type === "join_rejected");
};

/** Swing once (normal attack) then report the hit after the cadence passes. */
const swingAndHitEnemy = async (client, enemyId, waitMs = 340) => {
  await sleep(waitMs);
  client.send({ type: "player_attack", payload: { skill: "normal", x: 0, y: 0, facingRight: true } });
  client.send({ type: "enemy_hit", payload: { id: enemyId, damage: 9999 } });
};

test("WebSocket server-authority suite", async (t) => {
  let server;
  let port;
  let testDataDir;

  t.after(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  await t.test("Setup test HTTP & WebSocket server", async () => {
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-ws-test-"));
    process.env.DB_PATH = path.join(testDataDir, "ws.sqlite");
    process.env.NODE_ENV = "test";

    ({ createApp } = await import("../src/app.js"));
    ({ initGameSocket, ENEMY_MAX_HP } = await import("../src/websocket/gameSocket.js"));
    ({ store } = await import("../src/data/playerDb.js"));
    ({ userDb } = await import("../src/data/userDb.js"));

    // An admin account is required for the GM tests; registration marks the
    // "admin_" prefix as role=admin (see userDb.isAdmin).
    adminUserId = userDb.register("admin_ws_test", "123456", "Quản Trị Viên").id;

    const app = createApp();
    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = server.address().port;
        gameSocket = initGameSocket(server, {
          path: "/ws",
          enemyRespawnMs: 800,
          enemyTickMs: 50,
          // Deterministic rolls: 0.5 never crits and never rolls a dodge.
          random: () => 0.5,
          // Test authority: two tokens, one owned-character rule.
          verifyToken: (token) => {
            if (token === "test-token") return "test_user";
            if (token === "admin-token") return adminUserId;
            return null;
          },
          ownsCharacter: (_userId, characterId) => characterId !== "char_not_owned",
          findCharacter: (_userId, characterId) => ({
            id: characterId,
            name: characterId === "char_sync" ? "Độc Cô Cầu Bại" : characterId,
            sect: "thieu-lam",
            gender: characterId === "char_female" ? "female" : "male"
          })
        });
        resolve();
      });
    });

    assert.ok(port > 0, "Server bound to port");
  });

  await t.test("Join requires a verified token and an owned character", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    // No token.
    client.send({ type: "player_join", payload: { characterId: "char_a", x: 5000, y: 5000 } });
    assert.equal((await client.waitFor((m) => m.type === "join_rejected")).payload.reason, "auth");

    // Invalid token.
    client.send({ type: "player_join", payload: { token: "bad-token", characterId: "char_a" } });
    assert.equal((await client.waitFor((m) => m.type === "join_rejected")).payload.reason, "auth");

    // No character.
    client.send({ type: "player_join", payload: { token: "test-token" } });
    assert.equal((await client.waitFor((m) => m.type === "join_rejected")).payload.reason, "auth");

    // A character the account does not own.
    client.send({
      type: "player_join",
      payload: { token: "test-token", characterId: "char_not_owned" }
    });
    assert.equal((await client.waitFor((m) => m.type === "join_rejected")).payload.reason, "auth");

    await client.close();
  });

  await t.test("Join publishes authoritative state and ignores forged fields", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    // Forged level, stats, HP/MP, equipment and gender must all be ignored.
    const init = await join(client, {
      characterId: "char_sync",
      extra: {
        hp: 1,
        maxHp: 9999,
        mp: 0,
        maxMp: 9999,
        attack: 999,
        defense: 999,
        critRate: 1,
        level: 99,
        equipment: { armor: "cam-y-bao", weapon: 5 },
        gender: "female"
      }
    });
    assert.equal(init.type, "init_world");
    assert.equal(init.payload.yourId, "char_sync");
    assert.equal(init.payload.players.length, 0);

    // The player's display name and username must match the character's name, not the account's username/displayName.
    const joinedData = gameSocket.playerById.get("char_sync")?.data;
    assert.equal(joinedData?.displayName, "Độc Cô Cầu Bại");
    assert.equal(joinedData?.username, "Độc Cô Cầu Bại");

    const progress = await client.waitFor((m) => m.type === "player_progress");
    assert.equal(progress.payload.level, 1);
    assert.equal(progress.payload.exp, 0);
    assert.equal(progress.payload.coins, 0);
    assert.equal(progress.payload.kills, 0);

    const hp = await client.waitFor((m) => m.type === "player_hp" && m.payload.id === "char_sync");
    assert.equal(hp.payload.hp, 100);
    assert.equal(hp.payload.maxHp, 100);

    const mp = await client.waitFor((m) => m.type === "player_mp" && m.payload.id === "char_sync");
    assert.equal(mp.payload.mp, 60);
    assert.equal(mp.payload.maxMp, 60);

    const stats = await client.waitFor((m) => m.type === "player_stats");
    // Base attack 24 + the starter sword's +6.
    assert.equal(stats.payload.attack, 30);
    assert.equal(stats.payload.defense, 6);
    assert.equal(stats.payload.maxHp, 100);
    assert.equal(stats.payload.level, 1);

    const equipment = await client.waitFor((m) => m.type === "equipment_sync");
    assert.equal(equipment.payload.equipment.armor, null, "forged gear is ignored");
    assert.equal(equipment.payload.equipment.weapon, "kiem-lang-khach");

    const bag = await client.waitFor((m) => m.type === "inventory_sync");
    assert.equal(typeof bag.payload.inventory, "object");

    await client.close();
  });

  await t.test("Gender comes from the stored character, not the join packet", async () => {
    const observer = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(observer, { characterId: "char_observer" });

    const female = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(female, { characterId: "char_female", x: 5100, y: 5000 });

    const joined = await observer.waitFor(
      (m) => m.type === "player_joined" && m.payload.player.id === "char_female"
    );
    assert.equal(joined.payload.player.gender, "female");

    await female.close();
    await observer.close();
  });

  await t.test("Multiplayer broadcast: move, attack, chat, and leave", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    await join(client1, { characterId: "char_hero1" });
    const joined = client1.waitFor((m) => m.type === "player_joined");
    await join(client2, { characterId: "char_hero2", x: 5100, y: 5000 });

    const j = await joined;
    assert.equal(j.payload.player.id, "char_hero2");

    const init2 = client2.messages.find((m) => m.type === "init_world");
    assert.equal(init2.payload.players.length, 1);
    assert.equal(init2.payload.players[0].id, "char_hero1");

    // A legitimate step is broadcast to the rest of the map.
    client1.send({
      type: "player_move",
      payload: { x: 5050, y: 5000, vx: 120, vy: 0, direction: "right", stance: "side" }
    });
    const moved = await client2.waitFor(
      (m) => m.type === "player_moved" && m.payload.id === "char_hero1"
    );
    assert.equal(moved.payload.x, 5050);
    assert.equal(moved.payload.stance, "side");

    client1.send({
      type: "player_attack",
      payload: { skill: "normal", x: 5050, y: 5000, facingRight: true }
    });
    const attacked = await client2.waitFor(
      (m) => m.type === "player_attacked" && m.payload.id === "char_hero1"
    );
    assert.equal(attacked.payload.skill, "normal");

    client2.send({
      type: "player_chat",
      payload: { text: "Huynh đệ cùng tẩu giang hồ nhé!", channel: "world" }
    });
    const chat = await client1.waitFor((m) => m.type === "player_chat");
    assert.equal(chat.payload.text, "Huynh đệ cùng tẩu giang hồ nhé!");
    assert.equal(typeof chat.payload.sender, "string");
    assert.ok(chat.payload.sender.length > 0);

    await client2.close();
    const left = await client1.waitFor(
      (m) => m.type === "player_left" && m.payload.id === "char_hero2"
    );
    assert.equal(left.payload.id, "char_hero2");

    await client1.close();
  });

  await t.test("Movement is validated: a teleport jump is snapped back", async () => {
    const observer = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(observer, { characterId: "char_move_watch", x: 5300, y: 5000 });

    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_move", x: 5000, y: 5000 });

    // A 4000px jump cannot be covered in one step at walk speed.
    client.send({ type: "player_move", payload: { x: 9000, y: 5000, vx: 0, vy: 0 } });
    const snapped = await client.waitFor((m) => m.type === "player_moved" && m.payload.id === "char_move");
    assert.equal(snapped.payload.x, 5000, "the server keeps its own position");
    assert.equal(snapped.payload.y, 5000);

    // A small walk is accepted and broadcast to the rest of the map (the mover
    // is excluded from its own broadcast, so a peer observes it).
    client.send({ type: "player_move", payload: { x: 5100, y: 5000, vx: 120, vy: 0 } });
    const accepted = await observer.waitFor(
      (m) => m.type === "player_moved" && m.payload.id === "char_move"
    );
    assert.equal(accepted.payload.x, 5100);

    await client.close();
    await observer.close();
  });

  await t.test("Position is persisted server-side and restored on rejoin", async () => {
    const observer = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(observer, { characterId: "char_pos_watch", x: 5300, y: 5000 });

    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_pos", x: 5000, y: 5000 });

    // A legitimate step is accepted, broadcast and written to the ledger.
    client.send({ type: "player_move", payload: { x: 5080, y: 5020, vx: 120, vy: 0 } });
    const moved = await observer.waitFor(
      (m) => m.type === "player_moved" && m.payload.id === "char_pos"
    );
    assert.equal(moved.payload.x, 5080);

    // A rejected teleport must not overwrite the stored spot.
    client.send({ type: "player_move", payload: { x: 9000, y: 5000, vx: 0, vy: 0 } });
    await client.waitFor(
      (m) => m.type === "player_moved" && m.payload.id === "char_pos" && m.payload.x === 5080
    );
    assert.deepEqual(store.getPosition("char_pos"), {
      mapId: DEFAULT_MAP_ID,
      x: 5080,
      y: 5020
    });

    await client.close();

    // Rejoining with a stale client point resumes the server's stored one.
    const again = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const init = await join(again, { characterId: "char_pos", x: 5000, y: 5000 });
    assert.equal(init.type, "init_world");
    assert.equal(init.payload.mapId, DEFAULT_MAP_ID);
    assert.equal(init.payload.spawn.x, 5080);
    assert.equal(init.payload.spawn.y, 5020);

    await again.close();
    await observer.close();
  });

  await t.test("A stored map and position win over the join packet", async () => {
    const otherMapId = MAP_IDS.find((id) => id !== DEFAULT_MAP_ID);
    const otherMap = getMap(otherMapId);
    const stored = { mapId: otherMapId, x: otherMap.spawn.x, y: otherMap.spawn.y };
    store.setPosition("char_stored_map", stored);

    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const init = await join(client, { characterId: "char_stored_map", x: 5000, y: 5000 });
    assert.equal(init.type, "init_world");
    assert.equal(init.payload.mapId, otherMapId);
    assert.deepEqual(init.payload.spawn, { x: stored.x, y: stored.y });

    await client.close();
  });

  await t.test("Monster damage is authoritative (client damage is ignored)", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_dmg", x: 8350, y: 6000 });

    // No preceding swing: the hit is dropped, so damage cannot be minted freely.
    client.send({ type: "enemy_hit", payload: { id: 0, damage: 9999 } });
    await sleep(120);
    assert.equal(
      client.count((m) => m.type === "enemy_hit" && m.payload.damage > 0),
      0,
      "an unswung hit is ignored"
    );

    // After a real swing the server recomputes the damage from its own stats.
    client.send({ type: "player_attack", payload: { skill: "normal", x: 8400, y: 6000, facingRight: true } });
    client.send({ type: "enemy_hit", payload: { id: 0, damage: 9999 } });
    const hit = await client.waitFor((m) => m.type === "enemy_hit" && m.payload.damage > 0);
    assert.ok(hit.payload.damage < 9999, "the client-reported damage is ignored");
    assert.ok(hit.payload.damage <= 50, "damage stays within the plausible range");
    assert.equal(hit.payload.hp, ENEMY_MAX_HP - hit.payload.damage);

    await client.close();
  });

  await t.test("Skill casts are validated (weapon, unlock, passive, MP, damage)", async () => {
    // Give the hero gloves so the bao-tay kit is castable, and learn the skills
    // the test casts (books are the only way to learn them).
    store.setInventory("char_skill", { "bao-tay-lang-khach": 1 });
    store.addLearnedSkill("char_skill", "dai_tu_di_chuong");
    store.addLearnedSkill("char_skill", "nhu_lai_than_chuong");
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_skill", x: 9450, y: 6700 });
    client.send({ type: "equip_item", payload: { itemId: "bao-tay-lang-khach" } });
    await client.waitFor(
      (m) => m.type === "equipment_sync" && m.payload.equipment.weapon === "bao-tay-lang-khach"
    );

    // A sword skill cannot be cast while gloves are worn.
    client.send({ type: "player_attack", payload: { skill: "thieu_duong_kiem_phap" } });
    const wrongWeapon = await client.waitFor((m) => m.type === "skill_rejected");
    assert.equal(wrongWeapon.payload.reason, "weapon");

    // Locked at level 1.
    client.send({ type: "player_attack", payload: { skill: "nhu_lai_than_chuong" } });
    const locked = await client.waitFor((m) => m.type === "skill_rejected");
    assert.equal(locked.payload.reason, "locked");

    // A passive internal art cannot be cast.
    client.send({ type: "player_attack", payload: { skill: "thieu_lam_tam_phap" } });
    const passive = await client.waitFor((m) => m.type === "skill_rejected");
    assert.equal(passive.payload.reason, "passive");

    // A real cast spends its MP, then its follow-up hit is recomputed server-side.
    client.send({ type: "player_attack", payload: { skill: "dai_tu_di_chuong", x: 9500, y: 6700, facingRight: true } });
    const mp = await client.waitFor((m) => m.type === "player_mp" && m.payload.mp === 48);
    assert.equal(mp.payload.maxMp, 60);

    client.send({ type: "enemy_hit", payload: { id: 1, skill: "dai_tu_di_chuong", damage: 9999 } });
    const hit = await client.waitFor((m) => m.type === "enemy_hit" && m.payload.id === 1 && m.payload.damage > 0);
    assert.ok(hit.payload.damage < 9999);

    await client.close();
  });

  await t.test("Stun is applied by the server and holds the monster still", async () => {
    // Gloves carry the stun skill; the join hands out a sword.
    store.setInventory("char_stun", { "bao-tay-lang-khach": 1 });
    store.addLearnedSkill("char_stun", "dai_tu_di_chuong");
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    // Wolf 6 lives at (10500, 8200). A hero 900 units away is inside its aggro
    // range (1050) but well outside its stop distance (260), leaving enough
    // runway that it is still walking when the stun expires.
    await join(client, { characterId: "char_stun", x: 9600, y: 8200 });
    client.send({ type: "equip_item", payload: { itemId: "bao-tay-lang-khach" } });
    await client.waitFor(
      (m) => m.type === "equipment_sync" && m.payload.equipment.weapon === "bao-tay-lang-khach"
    );

    const movesWolf6 = (m) =>
      m.type === "enemy_moved" && m.payload.enemies.some((enemy) => enemy.id === 6);

    // Confirm the server is actively moving that wolf before we stun it.
    await client.waitFor(movesWolf6, 3000);

    // `dai_tu_di_chuong` carries an 800ms stun; the hit must survive the blow.
    client.send({
      type: "player_attack",
      payload: { skill: "dai_tu_di_chuong", x: 10500, y: 8200, facingRight: true }
    });
    client.send({ type: "enemy_hit", payload: { id: 6, skill: "dai_tu_di_chuong", damage: 9999 } });
    const hit = await client.waitFor(
      (m) => m.type === "enemy_hit" && m.payload.id === 6 && m.payload.damage > 0
    );
    assert.ok(hit.payload.hp > 0, "the stun skill does not kill the wolf");

    const before = client.messages.length;
    await sleep(500);
    assert.equal(
      client.messages.slice(before).filter(movesWolf6).length,
      0,
      "a stunned monster holds position"
    );

    // Once the stun expires the AI resumes and the wolf walks again.
    const resumed = await client.waitFor(movesWolf6, 2000);
    assert.ok(resumed);

    await client.close();
  });

  await t.test("Kill rewards credit the server-owned ledger", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_kill", x: 11050, y: 5900 });

    let reward = null;
    for (let attempt = 0; attempt < 8 && !reward; attempt++) {
      await swingAndHitEnemy(client, 2, attempt === 0 ? 0 : 340);
      try {
        reward = await client.waitFor(
          (m) => m.type === "enemy_reward" && m.payload.enemyId === 2,
          500
        );
      } catch {
        // keep swinging
      }
    }
    assert.ok(reward, "the monster dies after a few swings");
    assert.equal(reward.payload.exp, 35);
    assert.ok(reward.payload.coins >= 3 && reward.payload.coins <= 9);
    assert.equal(reward.payload.drop, undefined, "kills never grant items");

    const progress = await client.waitFor(
      (m) => m.type === "player_progress" && m.payload.kills >= 1
    );
    assert.equal(progress.payload.kills, 1);
    assert.equal(progress.payload.exp, 35);

    await client.close();
  });

  await t.test("Inventory is server-authoritative (use_item)", async () => {
    store.setInventory("char_item", { "kim-sang-duoc": 2, "hoi-thanh-phu": 1 });
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_item" });

    const initial = await client.waitFor((m) => m.type === "inventory_sync");
    assert.equal(initial.payload.inventory["kim-sang-duoc"], 2);

    client.send({ type: "use_item", payload: { itemId: "kim-sang-duoc" } });
    const first = await client.waitFor(
      (m) => m.type === "inventory_sync" && m.payload.inventory["kim-sang-duoc"] === 1
    );
    assert.equal(first.payload.inventory["kim-sang-duoc"], 1);

    const result = await client.waitFor((m) => m.type === "item_result" && m.payload.action === "use");
    assert.equal(result.payload.ok, true);

    // An exhausted stack is refused and never applied.
    client.send({ type: "use_item", payload: { itemId: "kim-sang-duoc" } });
    await client.waitFor(
      (m) => m.type === "inventory_sync" && !m.payload.inventory["kim-sang-duoc"]
    );
    client.send({ type: "use_item", payload: { itemId: "kim-sang-duoc" } });
    const refused = await client.waitFor(
      (m) => m.type === "item_result" && m.payload.action === "use" && m.payload.ok === false
    );
    assert.equal(refused.payload.ok, false);

    // The teleport scroll moves the player on the server.
    const spawn = getMap(DEFAULT_MAP_ID).spawn;
    client.send({ type: "use_item", payload: { itemId: "hoi-thanh-phu" } });
    const moved = await client.waitFor(
      (m) => m.type === "player_moved" && m.payload.id === "char_item"
    );
    assert.equal(moved.payload.x, spawn.x);
    assert.equal(moved.payload.y, spawn.y);

    await client.close();
  });

  await t.test("Equipment is server-authoritative", async () => {
    store.setInventory("char_eq", { "ao-lang-khach": 1 });
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_eq" });
    // Drain the join-time (empty) gear snapshot so the next one is the equip result.
    await client.waitFor((m) => m.type === "equipment_sync");

    client.send({ type: "equip_item", payload: { itemId: "ao-lang-khach" } });
    const equipped = await client.waitFor((m) => m.type === "equipment_sync");
    assert.equal(equipped.payload.equipment.armor, "ao-lang-khach");

    const result = await client.waitFor((m) => m.type === "item_result" && m.payload.action === "equip");
    assert.equal(result.payload.ok, true);
    assert.equal(result.payload.slot, "armor");

    // A forged stat report cannot change anything (the inbound message is gone).
    client.send({ type: "player_stats", payload: { defense: 9999, attack: 9999 } });
    await sleep(120);
    assert.equal(
      client.count((m) => m.type === "player_stats" && m.payload.defense === 9999),
      0,
      "forged stats are ignored"
    );

    // Taking it off returns it to the server bag.
    client.send({ type: "unequip_slot", payload: { slot: "armor" } });
    const unequipped = await client.waitFor(
      (m) => m.type === "equipment_sync" && m.payload.equipment.armor === null
    );
    assert.equal(unequipped.payload.equipment.armor, null);
    const bag = await client.waitFor(
      (m) => m.type === "inventory_sync" && m.payload.inventory["ao-lang-khach"] === 1
    );
    assert.equal(bag.payload.inventory["ao-lang-khach"], 1);

    await client.close();
  });

  await t.test("Shop purchases debit the server ledger", async () => {
    store.setProgress("char_shop", { level: 1, exp: 0, coins: 100, kills: 0 }, "char_shop");
    const npc = MARKET_NPCS.find((entry) => entry.shop === "pharmacy");
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_shop", x: npc.x, y: npc.y + 80 });

    const before = await client.waitFor((m) => m.type === "player_progress");
    assert.equal(before.payload.coins, 100);

    client.send({ type: "shop_buy", payload: { itemId: "kim-sang-duoc", qty: 1 } });
    const bought = await client.waitFor((m) => m.type === "shop_result");
    assert.equal(bought.payload.ok, true);
    assert.equal(bought.payload.total, 8);
    assert.equal(bought.payload.coins, 92);

    const progress = await client.waitFor(
      (m) => m.type === "player_progress" && m.payload.coins === 92
    );
    assert.equal(progress.payload.coins, 92);
    const bag = await client.waitFor(
      (m) => m.type === "inventory_sync" && m.payload.inventory["kim-sang-duoc"] === 1
    );
    assert.equal(bag.payload.inventory["kim-sang-duoc"], 1);

    await client.close();
  });

  await t.test("Wolves bite on the server and stream authoritative HP", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(client, { characterId: "char_bite", x: 8400, y: 6000 });

    const bite = await client.waitFor(
      (m) => m.type === "player_hp" && m.payload.id === "char_bite" && m.payload.damage > 0,
      3000
    );
    assert.equal(bite.payload.sourceName, "Sói Xám");
    assert.ok(bite.payload.damage >= 1);
    assert.equal(bite.payload.hp, 100 - bite.payload.damage);

    await client.close();
  });

  await t.test("PvP damage is recomputed (client damage is ignored)", async () => {
    const attacker = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const target = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    await join(attacker, { characterId: "char_pk1", x: 5000, y: 5000, extra: { pkFlag: true } });
    await join(target, { characterId: "char_pk2", x: 5150, y: 5000, extra: { pkFlag: true } });

    // A swing authorizes one strike; the reported 9999 is ignored.
    attacker.send({ type: "player_attack", payload: { skill: "normal", x: 5000, y: 5000, facingRight: true } });
    attacker.send({ type: "player_hit", payload: { targetId: "char_pk2", damage: 9999 } });
    const hit = await target.waitFor(
      (m) => m.type === "player_hp" && m.payload.id === "char_pk2" && m.payload.damage > 0
    );
    assert.ok(hit.payload.damage < 9999, "the client-reported damage is ignored");
    assert.equal(hit.payload.hp, 100 - hit.payload.damage);
    assert.equal(hit.payload.source, "pvp");

    // The immunity window blocks an immediate follow-up.
    const before = target.count(
      (m) => m.type === "player_hp" && m.payload.id === "char_pk2" && m.payload.damage > 0
    );
    attacker.send({ type: "player_attack", payload: { skill: "normal", x: 5000, y: 5000 } });
    attacker.send({ type: "player_hit", payload: { targetId: "char_pk2", damage: 9999 } });
    await sleep(150);
    assert.equal(
      target.count((m) => m.type === "player_hp" && m.payload.id === "char_pk2" && m.payload.damage > 0),
      before,
      "a hit during the immunity window is ignored"
    );

    // A peaceful target cannot be hit: the strike is rejected with a reason.
    const peaceful = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(peaceful, { characterId: "char_peace", x: 5150, y: 5020, extra: { pkFlag: false } });
    await sleep(400);
    attacker.send({ type: "player_attack", payload: { skill: "normal", x: 5000, y: 5000 } });
    attacker.send({ type: "player_hit", payload: { targetId: "char_peace", damage: 30 } });
    const rejected = await attacker.waitFor(
      (m) => m.type === "player_hit_rejected" && m.payload.reason === "target_peaceful"
    );
    assert.equal(rejected.payload.reason, "target_peaceful");

    await peaceful.close();
    await target.close();
    await attacker.close();
  });

  await t.test("GM actions require an administrator", async () => {
    const regular = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(regular, { characterId: "char_regular" });
    regular.send({ type: "gm_action", payload: { action: "set_level", level: 99 } });
    const err = await regular.waitFor((m) => m.type === "error");
    assert.match(err.payload.message, /quyền quản trị GM/);
    await regular.close();

    const admin = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    await join(admin, { characterId: "char_gm", token: "admin-token" });
    admin.send({ type: "gm_action", payload: { action: "set_level", level: 99 } });
    const progress = await admin.waitFor(
      (m) => m.type === "player_progress" && m.payload.level === 99
    );
    assert.equal(progress.payload.level, 99);
    await admin.close();
  });

  await t.test("Un-joined sockets cannot act on the world", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    client.send({ type: "enemy_hit", payload: { id: 3, damage: 40 } });
    client.send({ type: "player_hit", payload: { targetId: "char_any", damage: 40 } });
    client.send({ type: "player_move", payload: { x: 100, y: 100 } });
    client.send({ type: "use_item", payload: { itemId: "kim-sang-duoc" } });
    await sleep(120);

    // The server stays healthy and emits nothing on behalf of a non-player.
    client.send({ type: "ping" });
    assert.equal((await client.waitFor((m) => m.type === "pong")).type, "pong");
    assert.equal(client.count((m) => m.type === "enemy_hit"), 0);

    await client.close();
  });

  await t.test("Teardown test server", async () => {
    if (gameSocket?.wss) {
      gameSocket.wss.clients.forEach((client) => client.terminate());
    }
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(true);
  });
});
