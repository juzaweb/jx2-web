import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { WebSocket } from "ws";
import { createApp } from "../src/app.js";
import { initGameSocket, ENEMY_MAX_HP } from "../src/websocket/gameSocket.js";
import { ENEMY_TUNING } from "../../src/game/enemyAi.js";
import { DROP_TABLE } from "../../src/game/items.js";

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

  await t.test("Setup test HTTP & WebSocket server", async () => {
    const app = createApp();
    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = server.address().port;
        gameSocket = initGameSocket(server, { path: "/ws", enemyRespawnMs: 800, enemyTickMs: 50 });
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
        skill: "kiem_khi",
        x: 5300,
        y: 5100,
        facingRight: true
      }
    });

    const attackBroadcast = await client2.waitFor((m) => m.type === "player_attacked");
    assert.equal(attackBroadcast.payload.id, "usr_hero1");
    assert.equal(attackBroadcast.payload.skill, "kiem_khi");

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

  await t.test("Player HP is server-authoritative (stats set the ceiling, heals clamp)", async () => {
    const client1 = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    const client2 = await createTestClient(`ws://127.0.0.1:${port}/ws`);

    client1.send({ type: "player_join", payload: { id: "usr_hp1", username: "Hp1", x: 6400, y: 6200, hp: 100, maxHp: 100 } });
    await client1.waitFor((m) => m.type === "init_world");
    client2.send({ type: "player_join", payload: { id: "usr_hp2", username: "Hp2", x: 6600, y: 6200, hp: 80, maxHp: 120 } });
    await client2.waitFor((m) => m.type === "init_world");
    await client1.waitFor((m) => m.type === "player_joined");

    // The joiner already carries its health in the join snapshot
    const joinBroadcast = client1.messages.find((m) => m.type === "player_joined");
    assert.equal(joinBroadcast.payload.player.hp, 80);
    assert.equal(joinBroadcast.payload.player.maxHp, 120);

    // A client cannot set its own HP through a stats report: hp is ignored
    client2.send({ type: "player_stats", payload: { hp: 9999, maxHp: 120 } });
    const stats = await client1.waitFor((m) => m.type === "player_hp" && m.payload.id === "usr_hp2");
    assert.equal(stats.payload.hp, 80, "The reported hp is ignored; the server keeps its own");
    assert.equal(stats.payload.maxHp, 120);

    // A raised ceiling (level-up) heals to full on the server
    client2.send({ type: "player_stats", payload: { maxHp: 150 } });
    const grown = await client1.waitFor((m) => m.type === "player_hp" && m.payload.maxHp === 150);
    assert.equal(grown.payload.hp, 150);

    // A heal is clamped to the ceiling, never past it
    client2.send({ type: "player_heal", payload: { amount: 9999 } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(
      client2.messages.filter((m) => m.type === "player_hp" && m.payload.hp > 150).length,
      0,
      "A heal can never overflow the ceiling"
    );

    // Sockets that never joined cannot report stats or heal
    const spectator = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    spectator.send({ type: "player_stats", payload: { maxHp: 1 } });
    spectator.send({ type: "player_heal", payload: { amount: 50 } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(
      client1.messages.filter((m) => m.type === "player_hp" && m.payload.maxHp === 1).length,
      0,
      "An un-joined socket's report is ignored"
    );

    await spectator.close();
    await client2.close();
    await client1.close();
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
    const respawned = await client2.waitFor((m) => m.type === "enemy_respawned", 3000);
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
    assert.deepEqual(defeat.payload.respawn, { x: 6400, y: 6200 });

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

  await t.test("Teardown test server", async () => {
    gameSocket.close();
    await new Promise((res) => server.close(res));
  });
});

