import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { ENEMY_TUNING } from "../../src/game/enemyAi.js";
import { DROP_TABLE } from "../../src/game/items.js";
import { MARKET_SPAWN } from "../../src/game/marketLayout.js";
import { skillById } from "../../src/game/skills.js";

const THIEU_LAM_PALM_IDS = [
  "la_han_chuong",
  "vi_da_chuong",
  "dai_tu_di_chuong",
  "la_han_tran",
  "kim_cang_bat_hoai",
  "nhu_lai_than_thuong"
];
const HAS_THIEU_LAM_PALM_KIT = THIEU_LAM_PALM_IDS.every((id) => Boolean(skillById(id)));
const SKIP_NO_KIT = HAS_THIEU_LAM_PALM_KIT ? false : "Thiếu Lâm palm kit is not authored yet";

// Assigned in the setup subtest, after DB_PATH points at a throwaway file (the
// server-side modules open their SQLite database at import time).
let createApp;
let initGameSocket;
let ENEMY_MAX_HP;

const createTestClient = async (url) => {
  const ws = new WebSocket(url);
  const queue = [];
  const listeners = [];
  // Every parsed message, including ones a waitFor already consumed, so a test can
  // also assert that an event was *not* sent.
  const messages = [];

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i].predicate(msg)) {
          const l = listeners.splice(i, 1)[0];
          clearTimeout(l.timer);
          return l.resolve(msg);
        }
      }
      queue.push(msg);
    } catch {
      // ignore
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
        if (predicate(queue[i])) {
          return Promise.resolve(queue.splice(i, 1)[0]);
        }
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
    close: () =>
      new Promise((res) => {
        if (ws.readyState === WebSocket.CLOSED) return res();
        ws.on("close", res);
        ws.close();
      })
  };
};

test("WebSocket Real-time Multiplayer Suite", async (t) => {
  let server;
  let gameSocket;
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
    // Isolate the database before importing the server modules (they open SQLite
    // at import), so this suite never reads or writes the development database.
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-ws-test-"));
    process.env.DB_PATH = path.join(testDataDir, "ws.sqlite");
    process.env.NODE_ENV = "test";

    ({ createApp } = await import("../src/app.js"));
    ({ initGameSocket, ENEMY_MAX_HP } = await import("../src/websocket/gameSocket.js"));

    const app = createApp();
    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = server.address().port;
        gameSocket = initGameSocket(server, {
          path: "/ws",
          enemyRespawnMs: 800,
          enemyTickMs: 50,
          // Test authority: "test-token" is the account "test_user", and it owns
          // whichever character it asks for.
          verifyToken: (token) => (token === "test-token" ? "test_user" : null),
          ownsCharacter: () => true,
          // Disable AOI filtering for the general suite; the AOI test shrinks the
          // radius itself. (Otherwise most fixtures would sit outside the radius.)
          aoiRadius: 1e9
        });
        resolve();
      });
    });

    assert.ok(port > 0, "Server bound to port");
  });

  await t.test("Client 1 connects and receives init_world on join", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    // Send player_join
    client1.send({
      type: "player_join",
      payload: {
        id: "usr_alice",
        username: "alice",
        displayName: "Hiệp Nữ Alice",
        x: 6400,
        y: 6200,
        level: 5
      }
    });

    const initMsg = await client1.waitFor((m) => m.type === "init_world");
    assert.equal(initMsg.type, "init_world");
    assert.equal(initMsg.payload.yourId, "usr_alice");
    assert.equal(initMsg.payload.players.length, 0, "Alice is first player in world");

    await client1.close();
  });

  await t.test("Multiplayer broadcast: join, move, attack, chat, and leave", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    // Client 1 joins
    client1.send({
      type: "player_join",
      payload: {
        id: "usr_hero1",
        username: "Hero1",
        displayName: "Độc Cô Cầu Bại",
        x: 5000,
        y: 5000
      }
    });
    const init1 = await client1.waitFor((m) => m.type === "init_world");
    assert.equal(init1.payload.yourId, "usr_hero1");

    // Client 2 joins -> Client 1 should receive player_joined
    client2.send({
      type: "player_join",
      payload: {
        id: "usr_hero2",
        username: "Hero2",
        displayName: "Lệnh Hồ Xung",
        x: 5500,
        y: 5200
      }
    });

    const joinBroadcast = await client1.waitFor((m) => m.type === "player_joined");
    assert.equal(joinBroadcast.payload.player.id, "usr_hero2");
    assert.equal(joinBroadcast.payload.player.displayName, "Lệnh Hồ Xung");

    // Client 2 should have received init_world containing Hero1
    const client2Init = await client2.waitFor((m) => m.type === "init_world");
    assert.equal(client2Init.payload.players.length, 1);
    assert.equal(client2Init.payload.players[0].id, "usr_hero1");

    // Test movement broadcast: Client 1 moves -> Client 2 receives player_moved
    client1.send({
      type: "player_move",
      payload: {
        x: 5300,
        y: 5100,
        vx: 120,
        vy: 0,
        direction: "right",
        stance: "side"
      }
    });

    const moveBroadcast = await client2.waitFor((m) => m.type === "player_moved");
    assert.equal(moveBroadcast.payload.id, "usr_hero1");
    assert.equal(moveBroadcast.payload.x, 5300);
    assert.equal(moveBroadcast.payload.y, 5100);
    assert.equal(moveBroadcast.payload.stance, "side");

    // Test attack broadcast: Client 1 attacks -> Client 2 receives player_attacked
    client1.send({
      type: "player_attack",
      payload: {
        skill: "normal",
        x: 5300,
        y: 5100,
        facingRight: true
      }
    });

    const attackBroadcast = await client2.waitFor((m) => m.type === "player_attacked");
    assert.equal(attackBroadcast.payload.id, "usr_hero1");
    assert.equal(attackBroadcast.payload.skill, "normal");

    // Test chat broadcast: Client 2 chats -> Both receive player_chat
    client2.send({
      type: "player_chat",
      payload: {
        text: "Huynh đệ cùng tẩu giang hồ nhé!",
        channel: "world"
      }
    });

    const chatBroadcast1 = await client1.waitFor((m) => m.type === "player_chat");
    assert.equal(chatBroadcast1.payload.text, "Huynh đệ cùng tẩu giang hồ nhé!");
    assert.equal(chatBroadcast1.payload.sender, "Lệnh Hồ Xung");

    // Test disconnect: Client 2 disconnects -> Client 1 receives player_left
    await client2.close();

    const leaveBroadcast = await client1.waitFor(
      (m) => m.type === "player_left" && m.payload.id === "usr_hero2"
    );
    assert.equal(leaveBroadcast.payload.id, "usr_hero2");

    await client1.close();
  });

  await t.test("Equipment is sanitized on join and relayed when it changes", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    client1.send({
      type: "player_join",
      payload: {
        id: "usr_eq1",
        username: "Eq1",
        x: 4000,
        y: 4000,
        // Unknown slots and non-string ids must be dropped.
        equipment: { armor: "cam-y-bao", helmet: "phuong-vu-bao", bogus: "x", weapon: 5 }
      }
    });
    await client1.waitFor((m) => m.type === "init_world");

    // Client 2's init snapshot must carry client 1's worn slots, sanitized.
    client2.send({ type: "player_join", payload: { id: "usr_eq2", username: "Eq2", x: 4100, y: 4100 } });
    const init2 = await client2.waitFor((m) => m.type === "init_world");
    const snap = init2.payload.players.find((p) => p.id === "usr_eq1");
    assert.equal(snap.equipment.armor, "cam-y-bao");
    assert.equal(snap.equipment.helmet, "phuong-vu-bao");
    assert.equal(snap.equipment.weapon, null);
    assert.equal(snap.equipment.bogus, undefined);

    // A later change is relayed to peers only, with the same sanitizing.
    client1.send({
      type: "player_equipment",
      payload: { equipment: { weapon: "hac-ung-kiem", armor: null, junk: "x" } }
    });
    const relay = await client2.waitFor((m) => m.type === "player_equipment");
    assert.equal(relay.payload.id, "usr_eq1");
    assert.equal(relay.payload.equipment.weapon, "hac-ung-kiem");
    assert.equal(relay.payload.equipment.armor, null);
    assert.equal(relay.payload.equipment.junk, undefined);

    await client1.close();
    await client2.close();
  });

  await t.test("Gender is carried on join and broadcast to peers", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    client1.send({
      type: "player_join",
      payload: { id: "usr_g1", username: "G1", x: 400, y: 400, gender: "female" }
    });
    await client1.waitFor((m) => m.type === "init_world");

    // Client 2 connects only now, so it never sees the initial g1 broadcast and
    // its init snapshot is the first (and only) place g1's gender appears.
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    client2.send({ type: "player_join", payload: { id: "usr_g2", username: "G2", x: 410, y: 410, gender: "bogus" } });
    const init2 = await client2.waitFor((m) => m.type === "init_world");
    const snap = init2.payload.players.find((p) => p.id === "usr_g1");
    assert.equal(snap.gender, "female");

    // Unknown genders fall back to "male" (client 2 reported a bogus value).
    const joinBroadcast = await client1.waitFor(
      (m) => m.type === "player_joined" && m.payload.player.id === "usr_g2"
    );
    assert.equal(joinBroadcast.payload.player.gender, "male");

    // A character switch re-joins; the new gender rides the join broadcast so
    // peers redraw from player_joined (no dedicated gender packet exists).
    client1.send({
      type: "player_join",
      payload: { id: "usr_g1", username: "G1", x: 400, y: 400, gender: "male" }
    });
    const rejoined = await client2.waitFor(
      (m) => m.type === "player_joined" && m.payload.player.id === "usr_g1"
    );
    assert.equal(rejoined.payload.player.gender, "male");

    await client1.close();
    await client2.close();
  });

  await t.test("Player HP is server-authoritative (level-derived ceiling, heals clamp)", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    client1.send({ type: "player_join", payload: { id: "usr_hp1", username: "Hp1", x: 6400, y: 6200, hp: 100 } });
    await client1.waitFor((m) => m.type === "init_world");
    // The client-reported maxHp is ignored: the ceiling comes from the ledger (level 1 -> 100).
    client2.send({ type: "player_join", payload: { id: "usr_hp2", username: "Hp2", x: 6600, y: 6200, hp: 80, maxHp: 120 } });
    await client2.waitFor((m) => m.type === "init_world");
    await client1.waitFor((m) => m.type === "player_joined");

    // The joiner already carries its health in the join snapshot
    const joinBroadcast = client1.messages.find((m) => m.type === "player_joined");
    assert.equal(joinBroadcast.payload.player.hp, 80);
    assert.equal(joinBroadcast.payload.player.maxHp, 100, "maxHp is derived from the server-owned level");

    // A client cannot set its own HP or ceiling through a stats report
    const before = client1.messages.length;
    client2.send({ type: "player_stats", payload: { hp: 9999, maxHp: 9999, defense: 6 } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(
      client1.messages.slice(before).filter((m) => m.type === "player_hp").length,
      0,
      "A stats report can never change HP or the ceiling"
    );

    // A heal is clamped to the ceiling, never past it
    client2.send({ type: "player_heal", payload: { amount: 9999 } });
    const healed = await client1.waitFor((m) => m.type === "player_hp" && m.payload.id === "usr_hp2");
    assert.equal(healed.payload.hp, 100, "The heal clamps to the server ceiling");
    assert.equal(healed.payload.maxHp, 100);

    // Sockets that never joined cannot heal
    const spectator = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    spectator.send({ type: "player_heal", payload: { amount: 50 } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(
      client1.messages.filter((m) => m.type === "player_hp" && m.payload.id === undefined).length,
      0,
      "An un-joined socket's heal is ignored"
    );

    await spectator.close();
    await client2.close();
    await client1.close();
  });

  await t.test("MP is server-authoritative (skill cost, potion clamp, no free cast)", { skip: SKIP_NO_KIT }, async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    client.send({ type: "player_join", payload: { id: "usr_mp1", token: "test-token", characterId: "char_mp_1", username: "Mp1", x: 640, y: 620 } });
    await client.waitFor((m) => m.type === "init_world");

    // Each cast spends that skill's MP from the server-owned pool (level 1 -> maxMp 60).
    // Distinct skills are used so their individual cooldowns never block the next cast.
    const casts = [
      { skill: "la_han_chuong", mp: 55 },
      { skill: "vi_da_chuong", mp: 48 },
      { skill: "dai_tu_di_chuong", mp: 36 },
      { skill: "la_han_tran", mp: 18 },
      { skill: "kim_cang_bat_hoai", mp: 3 }
    ];
    for (const step of casts) {
      client.send({ type: "player_attack", payload: { skill: step.skill, x: 640, y: 620, facingRight: true } });
      const mp = await client.waitFor((m) => m.type === "player_mp" && m.payload.mp === step.mp);
      assert.equal(mp.payload.maxMp, 60);
      await new Promise((resolve) => setTimeout(resolve, 320));
    }

    // An unaffordable ultimate is refused: MP never goes negative
    client.send({ type: "player_attack", payload: { skill: "nhu_lai_than_thuong", x: 640, y: 620, facingRight: true } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const lastMp = client.messages.filter((m) => m.type === "player_mp").at(-1);
    assert.equal(lastMp.payload.mp, 3, "The refused cast spends nothing");

    // A restore is clamped to the ceiling
    client.send({ type: "player_restore_mp", payload: { amount: 9999 } });
    const refilled = await client.waitFor((m) => m.type === "player_mp" && m.payload.mp === 60);
    assert.equal(refilled.payload.maxMp, 60);

    await client.close();
  });

  await t.test("Skill hits are damage-authoritative (client damage is ignored)", { skip: SKIP_NO_KIT }, async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    client.send({
      type: "player_join",
      payload: {
        id: "usr_skilldmg",
        token: "test-token",
        characterId: "char_eco_1",
        username: "SkillDmg",
        x: 8400,
        y: 6000,
        attack: 40,
        critRate: 0
      }
    });
    await client.waitFor((m) => m.type === "init_world");

    // A hit without a preceding cast is ignored: damage cannot be minted freely.
    client.send({ type: "enemy_hit", payload: { id: 0, skill: "la_han_chuong", damage: 9999 } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(
      client.messages.filter((m) => m.type === "enemy_hit" && m.payload.damage > 0).length,
      0,
      "an uncast skill hit is dropped"
    );

    // After a real cast the server recomputes the damage from the catalog.
    client.send({ type: "player_attack", payload: { skill: "la_han_chuong", x: 8400, y: 6000, facingRight: true } });
    client.send({ type: "enemy_hit", payload: { id: 0, skill: "la_han_chuong", damage: 9999 } });
    const hit = await client.waitFor(
      (m) => m.type === "enemy_hit" && m.payload.id === 0 && m.payload.damage > 0
    );
    assert.ok(hit.payload.damage < 9999, "the server ignored the client-reported damage");
    assert.ok(hit.payload.damage <= 120, "damage stays within the skill's plausible range");

    await client.close();
  });

  await t.test("Kill rewards credit the server-owned ledger and persist", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    client.send({ type: "player_join", payload: { id: "usr_eco1", token: "test-token", characterId: "char_eco_1", username: "Eco1", x: 840, y: 600 } });
    await client.waitFor((m) => m.type === "init_world");

    // Joining seeds the ledger at level 1
    const seeded = client.messages.find((m) => m.type === "player_progress");
    assert.equal(seeded.payload.level, 1);
    assert.equal(seeded.payload.exp, 0);
    assert.equal(seeded.payload.coins, 0);
    assert.equal(seeded.payload.kills, 0);

    // Three kills at 35 EXP each reach level 2 (100 needed) with 5 EXP left over
    for (const id of [0, 1, 2]) {
      client.send({ type: "enemy_hit", payload: { id, damage: ENEMY_MAX_HP } });
      await client.waitFor((m) => m.type === "enemy_reward" && m.payload.enemyId === id);
    }
    const finalProgress = await client.waitFor((m) => m.type === "player_progress" && m.payload.kills === 3);
    assert.equal(finalProgress.payload.exp, 5);
    assert.equal(finalProgress.payload.level, 2);
    assert.ok(finalProgress.payload.coins >= 9 && finalProgress.payload.coins <= 27);
    assert.equal(finalProgress.payload.maxHp, 120, "maxHp follows the new level");

    // A level-up also refills MP to the new (higher) ceiling
    const mpRefill = await client.waitFor((m) => m.type === "player_mp" && m.payload.maxMp === 70);
    assert.equal(mpRefill.payload.mp, 70, "A level-up refills MP");

    // The derived leaderboard carries the character's resolved display name
    const lb = await (await fetch(`http://127.0.0.1:${port}/api/leaderboard?sortBy=level&limit=50`)).json();
    const entry = lb.data.rankings.find((r) => r.playerId === "char_eco_1");
    assert.ok(entry, "The played character appears in the leaderboard");
    assert.equal(entry.playerName, "Eco1");
    assert.equal(entry.level, 2);

    await client.close();

    // The ledger survives a reconnect (persisted by the server)
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    client2.send({ type: "player_join", payload: { id: "usr_eco1b", token: "test-token", characterId: "char_eco_1", username: "Eco1", x: 840, y: 600 } });
    await client2.waitFor((m) => m.type === "init_world");
    const resumed = await client2.waitFor((m) => m.type === "player_progress");
    assert.equal(resumed.payload.level, 2);
    assert.equal(resumed.payload.kills, 3);
    await client2.close();
  });

  await t.test("Shop purchases debit server silver and store the item", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    client.send({
      type: "player_join",
      payload: {
        id: "usr_shop",
        token: "test-token",
        characterId: "char_shop_1",
        username: "Shop",
        x: 6400,
        y: 6050
      }
    });
    await client.waitFor((m) => m.type === "init_world");

    // Buying from across the map is refused even with silver.
    client.send({ type: "shop_buy", payload: { itemId: "kim-sang-duoc", qty: 1 } });
    const farAway = await client.waitFor(
      (m) => m.type === "shop_result" && m.payload.ok === false
    );
    assert.equal(farAway.payload.reason, "range");
    assert.equal(farAway.payload.coins, 0, "a refused purchase spends nothing");

    // Walk up to the Dược Sư, then earn silver deterministically from the
    // one-off quest payout instead of killing shared enemies (that would
    // perturb the later enemy-state tests).
    client.send({ type: "player_move", payload: { x: 4580, y: 7200, vx: 0, vy: 0 } });
    client.send({ type: "quest_claim", payload: {} });
    const earned = await client.waitFor((m) => m.type === "player_progress" && m.payload.coins > 0);
    assert.equal(earned.payload.coins, 20);

    client.send({ type: "shop_buy", payload: { itemId: "kim-sang-duoc", qty: 1 } });
    const bought = await client.waitFor((m) => m.type === "shop_result");
    assert.equal(bought.payload.ok, true);
    assert.equal(bought.payload.itemId, "kim-sang-duoc");
    assert.equal(bought.payload.qty, 1);
    assert.equal(bought.payload.total, 8);
    assert.equal(bought.payload.coins, earned.payload.coins - 8, "silver is debited by the server");

    // The authoritative ledger and bag both reflect the purchase.
    const progress = await client.waitFor((m) => m.type === "player_progress" && m.payload.coins === earned.payload.coins - 8);
    assert.equal(progress.payload.coins, earned.payload.coins - 8);

    // Unknown stock and unaffordable quantities are refused without charging.
    client.send({ type: "shop_buy", payload: { itemId: "thiet-trao", qty: 1 } });
    const unknown = await client.waitFor((m) => m.type === "shop_result" && m.payload.ok === false);
    assert.equal(unknown.payload.reason, "unknown");

    client.send({ type: "shop_buy", payload: { itemId: "nu-nhi-hong", qty: 99 } });
    const poor = await client.waitFor(
      (m) => m.type === "shop_result" && m.payload.ok === false && m.payload.reason === "coins"
    );
    assert.equal(poor.payload.coins, earned.payload.coins - 8, "a refused purchase spends nothing");

    await client.close();

    // The server bag is authoritative and already contains the purchase.
    const inventory = await (await fetch(`http://127.0.0.1:${port}/api/inventory/char_shop_1`)).json();
    assert.equal(inventory.data.inventory["kim-sang-duoc"], 1, "the purchase is stored on the server bag");

    // A guest (no verified character) cannot trade.
    const guest = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    guest.send({ type: "player_join", payload: { id: "usr_shop_guest", username: "Guest" } });
    await guest.waitFor((m) => m.type === "init_world");
    guest.send({ type: "shop_buy", payload: { itemId: "kim-sang-duoc", qty: 1 } });
    const refused = await guest.waitFor((m) => m.type === "shop_result");
    assert.equal(refused.payload.ok, false);
    assert.equal(refused.payload.reason, "guest");
    await guest.close();
  });

  await t.test("Unauthenticated joins earn nothing", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    // No token: the player is present but owns no ledger.
    client.send({ type: "player_join", payload: { id: "usr_guest", characterId: "char_eco_1", username: "Guest", x: 840, y: 600 } });
    await client.waitFor((m) => m.type === "init_world");

    assert.equal(
      client.messages.filter((m) => m.type === "player_progress").length,
      0,
      "An unauthenticated join is not sent a ledger"
    );

    client.send({ type: "enemy_hit", payload: { id: 4, damage: ENEMY_MAX_HP } });
    await client.waitFor((m) => m.type === "enemy_reward" && m.payload.enemyId === 4);
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(
      client.messages.filter((m) => m.type === "player_progress").length,
      0,
      "A kill by an unauthenticated player pays no progress"
    );

    await client.close();

    // The owned character's ledger is untouched by the guest's kill.
    const owner = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    owner.send({ type: "player_join", payload: { id: "usr_owner", token: "test-token", characterId: "char_eco_1", username: "Owner", x: 840, y: 600 } });
    await owner.waitFor((m) => m.type === "init_world");
    const progress = await owner.waitFor((m) => m.type === "player_progress");
    assert.equal(progress.payload.kills, 3, "The guest's kill did not credit the owned character");
    await owner.close();
  });

  await t.test("Wolves bite on the server and stream authoritative HP", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    // Stand on wolf 0's home; it settles within bite range immediately
    client.send({
      type: "player_join",
      payload: { id: "usr_bite", username: "Bite", x: 8400, y: 6000, hp: 100, maxHp: 100, defense: 6 }
    });
    await client.waitFor((m) => m.type === "init_world");

    const bite = await client.waitFor((m) => m.type === "player_hp" && m.payload.damage > 0, 3000);
    assert.equal(bite.payload.id, "usr_bite");
    assert.equal(bite.payload.sourceName, "Sói Xám");
    assert.ok(bite.payload.damage >= 1);
    assert.equal(bite.payload.hp, 100 - bite.payload.damage, "HP reflects the server-rolled bite");

    await client.close();
  });

  await t.test("Heartbeat ping-pong responds", async () => {
    const client = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    client.send({ type: "ping" });
    const pong = await client.waitFor((m) => m.type === "pong");
    assert.equal(pong.type, "pong");
    assert.ok(pong.time > 0);

    await client.close();
  });

  await t.test("Enemy state is server-managed: shared HP, shared death and respawn", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    client1.send({ type: "player_join", payload: { id: "usr_wolf1", username: "Wolf1", x: 8400, y: 6000 } });
    const init1 = await client1.waitFor((m) => m.type === "init_world");
    assert.equal(init1.payload.enemies.length, 8, "World init ships the full enemy roster");
    assert.equal(init1.payload.enemies[0].hp, ENEMY_MAX_HP);
    assert.equal(init1.payload.enemies[0].isDead, false);

    client2.send({ type: "player_join", payload: { id: "usr_wolf2", username: "Wolf2", x: 9000, y: 6400 } });
    await client2.waitFor((m) => m.type === "init_world");
    await client1.waitFor((m) => m.type === "player_joined");

    // Hero1 hits wolf 0 for 20 -> both players must see 25 HP
    client1.send({ type: "enemy_hit", payload: { id: 0, damage: 20, x: 8400, y: 6000 } });
    const hit1 = await client1.waitFor((m) => m.type === "enemy_hit");
    const hit2 = await client2.waitFor((m) => m.type === "enemy_hit");
    assert.equal(hit1.payload.hp, 25);
    assert.equal(hit2.payload.hp, 25);
    assert.equal(hit2.payload.attackerId, "usr_wolf1");
    assert.equal(hit2.payload.damage, 20);

    // Hero2 finishes it -> the death is shared
    client2.send({ type: "enemy_hit", payload: { id: 0, damage: 25 } });
    const kill1 = await client1.waitFor((m) => m.type === "enemy_hit" && m.payload.isDead === true);
    const kill2 = await client2.waitFor((m) => m.type === "enemy_hit" && m.payload.isDead === true);
    assert.equal(kill1.payload.hp, 0);
    assert.equal(kill1.payload.attackerId, "usr_wolf2");
    assert.equal(kill2.payload.hp, 0);

    // The killing blow's reward is rolled by the server and shared by both clients
    const reward1 = await client1.waitFor((m) => m.type === "enemy_reward");
    const reward2 = await client2.waitFor((m) => m.type === "enemy_reward");
    assert.equal(reward1.payload.enemyId, 0);
    assert.equal(reward1.payload.attackerId, "usr_wolf2");
    assert.equal(reward2.payload.attackerId, "usr_wolf2");
    assert.equal(reward1.payload.exp, 35);
    assert.ok(reward1.payload.coins >= 3 && reward1.payload.coins <= 9);
    assert.ok(
      DROP_TABLE.some((entry) => entry.id === reward1.payload.drop.id),
      "The reward always carries a catalog-backed drop"
    );

    // Hitting a corpse resyncs instead of dealing damage twice
    client1.send({ type: "enemy_hit", payload: { id: 0, damage: 25 } });
    const resync = await client1.waitFor((m) => m.type === "enemy_hit" && m.payload.damage === 0);
    assert.equal(resync.payload.hp, 0);
    assert.equal(resync.payload.isDead, true);

    // A corpse hit resyncs and can never pay a second reward
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      client1.messages.filter((m) => m.type === "enemy_reward").length,
      1,
      "Only the killing blow pays a reward"
    );

    // Respawn is driven by the server clock, not by the killer's client
    const respawned = await client2.waitFor(
      (m) => m.type === "enemy_respawned" && m.payload.id === 0,
      3000
    );
    assert.equal(respawned.payload.id, 0);
    assert.equal(respawned.payload.hp, ENEMY_MAX_HP);
    assert.equal(respawned.payload.isDead, false);

    // Unknown ids and malformed reports are ignored
    client1.send({ type: "enemy_hit", payload: { id: 99, damage: 10 } });
    client1.send({ type: "enemy_hit", payload: { id: 0, damage: -50 } });
    client1.send({ type: "enemy_move", payload: {} });

    // Damage cannot move a wolf: wolf 6 sits at its home (1050, 820), out of every
    // player's range, and a hit carrying a bogus position must not relocate it
    client1.send({ type: "enemy_hit", payload: { id: 6, damage: 1, x: 100, y: 100 } });
    const hitWolf6 = await client1.waitFor((m) => m.type === "enemy_hit" && m.payload.id === 6);
    assert.equal(hitWolf6.payload.x, 10500, "The server keeps its own enemy position");
    assert.equal(hitWolf6.payload.y, 8200);

    // Movement is server-owned: a client's own position report changes nothing.
    // Wolf 5 sits at its home (760, 800) with nobody in range, so it must stay there.
    client1.send({ type: "enemy_move", payload: { enemies: [{ id: 5, x: 9000, y: 6400 }] } });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(
      client1.messages.filter(
        (m) => m.type === "enemy_moved" && m.payload.enemies.some((enemy) => enemy.id === 5)
      ).length,
      0,
      "A client-reported enemy position is ignored"
    );

    // Sockets that never joined cannot touch the shared enemy state
    const spectator = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    spectator.send({ type: "enemy_hit", payload: { id: 3, damage: 40 } });
    spectator.send({ type: "enemy_move", payload: { enemies: [{ id: 3, x: 100, y: 100 }] } });
    spectator.send({ type: "player_join", payload: { id: "usr_wolf3", username: "Wolf3", x: 1000, y: 1000 } });

    const spectatorInit = await spectator.waitFor((m) => m.type === "init_world");
    const wolfThree = spectatorInit.payload.enemies.find((e) => e.id === 3);
    assert.equal(wolfThree.hp, ENEMY_MAX_HP, "Un-joined sockets cannot damage enemies");
    assert.equal(wolfThree.x, 12600, "Un-joined sockets cannot move enemies");

    spectator.send({ type: "ping" });
    assert.equal((await spectator.waitFor((m) => m.type === "pong")).type, "pong", "Server stays healthy");

    await spectator.close();
    await client2.close();
    await client1.close();
  });

  await t.test("Enemy movement is server-owned and shared by every player", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    // Wolf 1 spawns at (950, 670): client2 stands next to it, client1 is far away
    client1.send({ type: "player_join", payload: { id: "usr_move1", username: "Move1", x: 14000, y: 6700 } });
    await client1.waitFor((m) => m.type === "init_world");
    client2.send({ type: "player_join", payload: { id: "usr_move2", username: "Move2", x: 10500, y: 6700 } });
    await client2.waitFor((m) => m.type === "init_world");
    await client1.waitFor((m) => m.type === "player_joined");

    const nearPlayer = { x: 10500, y: 6700 };
    const stopDistance = ENEMY_TUNING.stopDistance;
    const wolfOne = (m) =>
      m.type === "enemy_moved" ? m.payload.enemies.find((enemy) => enemy.id === 1) : null;
    const settled = (m) => {
      const wolf = wolfOne(m);
      return Boolean(wolf) && Math.hypot(wolf.x - nearPlayer.x, wolf.y - nearPlayer.y) <= stopDistance + 1;
    };

    // Both players watch the wolf walk to the *nearer* player, not to their own
    const seenByFarPlayer = await client1.waitFor(settled, 4000);
    const seenByNearPlayer = await client2.waitFor(settled, 4000);
    assert.ok(wolfOne(seenByFarPlayer).x < nearPlayer.x, "The far player sees it hold short of the nearer player");
    assert.ok(wolfOne(seenByNearPlayer).x < nearPlayer.x);

    // At rest the AI produces no delta, so the tick stops broadcasting that wolf
    const before = client1.messages.length;
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(
      client1.messages.slice(before).filter((m) => wolfOne(m)).length,
      0,
      "A settled wolf stops generating movement traffic"
    );

    await client1.close();
    await client2.close();
  });

  await t.test("PvP: the server applies damage, gates on PK flag and range, and respawns the loser", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    // Client 1 joins with the PK flag on
    client1.send({
      type: "player_join",
      payload: { id: "usr_pk1", username: "Pk1", displayName: "Kiếm Khách", x: 5000, y: 5000, hp: 100, maxHp: 100, pkFlag: true }
    });
    await client1.waitFor((m) => m.type === "init_world");

    // Client 2 joins flagged too, close to client 1
    client2.send({
      type: "player_join",
      payload: { id: "usr_pk2", username: "Pk2", displayName: "Đao Khách", x: 5400, y: 5200, hp: 100, maxHp: 100, pkFlag: true }
    });
    const init2 = await client2.waitFor((m) => m.type === "init_world");
    assert.equal(init2.payload.players[0].pkFlag, true, "The PK flag travels in the world snapshot");

    const joined2 = await client1.waitFor((m) => m.type === "player_joined");
    assert.equal(joined2.payload.player.pkFlag, true);

    // A flagged hit inside range is applied by the server and streamed as HP
    client1.send({ type: "player_hit", payload: { targetId: "usr_pk2", damage: 20 } });
    const hit = await client2.waitFor((m) => m.type === "player_hp" && m.payload.id === "usr_pk2" && m.payload.damage > 0);
    assert.equal(hit.payload.hp, 80);
    assert.equal(hit.payload.damage, 20);
    assert.equal(hit.payload.sourceName, "Kiếm Khách");

    // The immunity window blocks an immediate follow-up hit
    const hitsSoFar = client2.messages.filter((m) => m.type === "player_hp" && m.payload.id === "usr_pk2" && m.payload.damage > 0).length;
    client1.send({ type: "player_hit", payload: { targetId: "usr_pk2", damage: 20 } });
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      client2.messages.filter((m) => m.type === "player_hp" && m.payload.id === "usr_pk2" && m.payload.damage > 0).length,
      hitsSoFar,
      "A hit during the immunity window is ignored"
    );

    // A peaceful target cannot be hit
    const peaceful = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    peaceful.send({
      type: "player_join",
      payload: { id: "usr_peace", username: "Peace", x: 5000, y: 5200, hp: 100, maxHp: 100, pkFlag: false }
    });
    await peaceful.waitFor((m) => m.type === "init_world");
    await client1.waitFor((m) => m.type === "player_joined" && m.payload.player.id === "usr_peace");

    client1.send({ type: "player_hit", payload: { targetId: "usr_peace", damage: 30 } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      peaceful.messages.filter((m) => m.type === "player_hp" && m.payload.damage > 0).length,
      0,
      "A player without the PK flag is immune"
    );

    // Self-hits, unknown targets and negative damage never land
    client1.send({ type: "player_hit", payload: { targetId: "usr_pk1", damage: 10 } });
    client1.send({ type: "player_hit", payload: { targetId: "nobody", damage: 10 } });
    client1.send({ type: "player_hit", payload: { targetId: "usr_pk2", damage: -5 } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      client2.messages.filter((m) => m.type === "player_hp" && m.payload.damage === 10).length,
      0,
      "Self, unknown and negative hits never land"
    );

    // Damage is clamped and a lethal blow respawns the victim at Biện Kinh
    await new Promise((resolve) => setTimeout(resolve, 750));
    client1.send({ type: "player_hit", payload: { targetId: "usr_pk2", damage: 9999 } });
    const lethal = await client2.waitFor((m) => m.type === "player_hp" && m.payload.id === "usr_pk2" && m.payload.hp === 0);
    assert.equal(lethal.payload.damage, 200, "Damage is clamped to the shared ceiling");

    const defeat = await client2.waitFor((m) => m.type === "player_defeated");
    assert.equal(defeat.payload.victimId, "usr_pk2");
    assert.equal(defeat.payload.attackerId, "usr_pk1");
    assert.equal(defeat.payload.attackerName, "Kiếm Khách");
    assert.deepEqual(defeat.payload.respawn, { x: MARKET_SPAWN.x, y: MARKET_SPAWN.y });

    const restored = await client2.waitFor((m) => m.type === "player_hp" && m.payload.id === "usr_pk2" && m.payload.hp === 100);
    assert.equal(restored.payload.maxHp, 100);

    // The victim is now at the respawn point, out of the attacker's range
    await new Promise((resolve) => setTimeout(resolve, 750));
    const afterRespawn = client2.messages.filter((m) => m.type === "player_hp" && m.payload.id === "usr_pk2").length;
    client1.send({ type: "player_hit", payload: { targetId: "usr_pk2", damage: 10 } });
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      client2.messages.filter((m) => m.type === "player_hp" && m.payload.id === "usr_pk2").length,
      afterRespawn,
      "A hit beyond the melee range is dropped"
    );

    // PK flag toggles are relayed
    client1.send({ type: "player_pk", payload: { pkFlag: false } });
    const pk = await client2.waitFor((m) => m.type === "player_pk");
    assert.equal(pk.payload.id, "usr_pk1");
    assert.equal(pk.payload.pkFlag, false);

    await peaceful.close();
    await client2.close();
    await client1.close();
  });

  await t.test("Combat actions are rate-limited (anti-amplification)", async () => {
    const attacker = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const observer = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    attacker.send({ type: "player_join", payload: { id: "rl1", username: "Rl1", x: 500, y: 500, pkFlag: true } });
    await attacker.waitFor((m) => m.type === "init_world");
    observer.send({ type: "player_join", payload: { id: "rl2", username: "Rl2", x: 5000, y: 5000 } });
    await observer.waitFor((m) => m.type === "init_world");

    // Ten attacks fired back-to-back collapse to a single broadcast
    for (let i = 0; i < 10; i++) {
      attacker.send({ type: "player_attack", payload: { skill: "normal", x: 500, y: 500, facingRight: true } });
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      observer.messages.filter((m) => m.type === "player_attacked" && m.payload.id === "rl1").length,
      1,
      "Rapid attacks within the cooldown yield one broadcast"
    );

    await attacker.close();
    await observer.close();
  });

  await t.test("Area of interest: streaming updates stay local", async () => {
    const mover = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const nearObserver = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const farObserver = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    mover.send({ type: "player_join", payload: { id: "aoi_mover", username: "M", x: 1000, y: 1000 } });
    await mover.waitFor((m) => m.type === "init_world");
    nearObserver.send({ type: "player_join", payload: { id: "aoi_near", username: "N", x: 1050, y: 1000 } });
    await nearObserver.waitFor((m) => m.type === "init_world");
    farObserver.send({ type: "player_join", payload: { id: "aoi_far", username: "F", x: 6000, y: 6000 } });
    await farObserver.waitFor((m) => m.type === "init_world");

    const radius = gameSocket.aoiRadius;
    gameSocket.aoiRadius = 400;
    mover.send({ type: "player_move", payload: { x: 1010, y: 1000 } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    gameSocket.aoiRadius = radius;

    const isMover = (m) => m.type === "player_moved" && m.payload.id === "aoi_mover";
    assert.equal(nearObserver.messages.filter(isMover).length, 1, "A nearby observer receives the update");
    assert.equal(farObserver.messages.filter(isMover).length, 0, "A far observer does not");

    await mover.close();
    await nearObserver.close();
    await farObserver.close();
  });

  await t.test("Area of interest: the victim always learns of its own defeat", async () => {
    const attacker = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const victim = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const farObserver = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    attacker.send({ type: "player_join", payload: { id: "kill_atk", username: "A", x: 1000, y: 1000, hp: 100, pkFlag: true } });
    await attacker.waitFor((m) => m.type === "init_world");
    victim.send({ type: "player_join", payload: { id: "kill_vic", username: "V", x: 1010, y: 1000, hp: 100, pkFlag: true } });
    await victim.waitFor((m) => m.type === "init_world");
    farObserver.send({ type: "player_join", payload: { id: "kill_far", username: "F", x: 9000, y: 9000 } });
    await farObserver.waitFor((m) => m.type === "init_world");

    const radius = gameSocket.aoiRadius;
    gameSocket.aoiRadius = 400;
    attacker.send({ type: "player_hit", payload: { targetId: "kill_vic", damage: 100 } });
    // The victim is teleported on death, so it must still receive the message
    // even though it now sits far from the fight's AOI.
    await victim.waitFor((m) => m.type === "player_defeated" && m.payload.victimId === "kill_vic");
    await new Promise((resolve) => setTimeout(resolve, 80));
    gameSocket.aoiRadius = radius;

    assert.equal(
      farObserver.messages.filter((m) => m.type === "player_defeated").length,
      0,
      "A far player does not see the defeat"
    );

    await attacker.close();
    await victim.close();
    await farObserver.close();
  });

  await t.test("Backpressure: lagging sockets are skipped", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    client1.send({ type: "player_join", payload: { id: "bp1", username: "Bp1", x: 100, y: 100 } });
    await client1.waitFor((m) => m.type === "init_world");
    client2.send({ type: "player_join", payload: { id: "bp2", username: "Bp2", x: 100, y: 100 } });
    await client2.waitFor((m) => m.type === "init_world");
    await client1.waitFor((m) => m.type === "player_joined");

    const threshold = gameSocket.maxBufferedBytes;
    gameSocket.maxBufferedBytes = 0; // every socket now counts as "lagging"
    client1.send({ type: "player_move", payload: { x: 110, y: 110 } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    gameSocket.maxBufferedBytes = threshold;

    assert.equal(
      client2.messages.filter((m) => m.type === "player_moved").length,
      0,
      "A skipped broadcast never reaches the lagging socket"
    );

    client1.send({ type: "player_move", payload: { x: 120, y: 120 } });
    const moved = await client2.waitFor((m) => m.type === "player_moved");
    assert.equal(moved.payload.x, 120, "With the threshold restored, updates flow again");

    await client1.close();
    await client2.close();
  });

  await t.test("Teardown test server", async () => {
    gameSocket.close();
    await new Promise((res) => server.close(res));
  });
});

