import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { WebSocket } from "ws";
import { createApp } from "../src/app.js";
import { initGameSocket, ENEMY_MAX_HP } from "../src/websocket/gameSocket.js";
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
        gameSocket = initGameSocket(server, { path: "/ws", enemyRespawnMs: 800 });
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
        x: 640,
        y: 620,
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
        x: 500,
        y: 500
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
        x: 550,
        y: 520
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
        x: 530,
        y: 510,
        vx: 120,
        vy: 0,
        direction: "right",
        stance: "side"
      }
    });

    const moveBroadcast = await client2.waitFor((m) => m.type === "player_moved");
    assert.equal(moveBroadcast.payload.id, "usr_hero1");
    assert.equal(moveBroadcast.payload.x, 530);
    assert.equal(moveBroadcast.payload.y, 510);
    assert.equal(moveBroadcast.payload.stance, "side");

    // Test attack broadcast: Client 1 attacks -> Client 2 receives player_attacked
    client1.send({
      type: "player_attack",
      payload: {
        skill: "kiem_khi",
        x: 530,
        y: 510,
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

    client1.send({ type: "player_join", payload: { id: "usr_wolf1", username: "Wolf1", x: 840, y: 600 } });
    const init1 = await client1.waitFor((m) => m.type === "init_world");
    assert.equal(init1.payload.enemies.length, 8, "World init ships the full enemy roster");
    assert.equal(init1.payload.enemies[0].hp, ENEMY_MAX_HP);
    assert.equal(init1.payload.enemies[0].isDead, false);

    client2.send({ type: "player_join", payload: { id: "usr_wolf2", username: "Wolf2", x: 900, y: 640 } });
    await client2.waitFor((m) => m.type === "init_world");
    await client1.waitFor((m) => m.type === "player_joined");

    // Hero1 hits wolf 0 for 20 -> both players must see 25 HP
    client1.send({ type: "enemy_hit", payload: { id: 0, damage: 20, x: 840, y: 600 } });
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

    // Position reports relay only meaningful drift to the other players
    client1.send({ type: "enemy_move", payload: { enemies: [{ id: 1, x: 950, y: 670 }] } });
    client1.send({ type: "enemy_move", payload: { enemies: [{ id: 2, x: 1400, y: 700 }] } });
    const moved = await client2.waitFor((m) => m.type === "enemy_moved");
    assert.deepEqual(moved.payload.enemies, [{ id: 2, x: 1400, y: 700 }]);

    // Sockets that never joined cannot touch the shared enemy state
    const spectator = await createTestClient(`ws://127.0.0.1:${port}/ws`);
    spectator.send({ type: "enemy_hit", payload: { id: 3, damage: 40 } });
    spectator.send({ type: "enemy_move", payload: { enemies: [{ id: 3, x: 10, y: 10 }] } });
    spectator.send({ type: "player_join", payload: { id: "usr_wolf3", username: "Wolf3", x: 100, y: 100 } });

    const spectatorInit = await spectator.waitFor((m) => m.type === "init_world");
    const wolfThree = spectatorInit.payload.enemies.find((e) => e.id === 3);
    assert.equal(wolfThree.hp, ENEMY_MAX_HP, "Un-joined sockets cannot damage enemies");
    assert.equal(wolfThree.x, 1260, "Un-joined sockets cannot move enemies");

    spectator.send({ type: "ping" });
    assert.equal((await spectator.waitFor((m) => m.type === "pong")).type, "pong", "Server stays healthy");

    await spectator.close();
    await client2.close();
    await client1.close();
  });

  await t.test("Teardown test server", async () => {
    gameSocket.close();
    await new Promise((res) => server.close(res));
  });
});

