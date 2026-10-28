import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-quest-ws-"));
process.env.DB_PATH = path.join(dir, "quest-ws.sqlite");
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initGameSocket } = await import("../src/websocket/gameSocket.js");
const { store } = await import("../src/data/playerDb.js");
const { MARKET_NPCS } = await import("../../src/game/marketLayout.js");
const { questById } = await import("../../src/game/quests/catalog.js");

const npc = (id) => MARKET_NPCS.find((entry) => entry.id === id);

const createClient = async (url) => {
  const ws = new WebSocket(url);
  const queue = [];
  const listeners = [];
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      for (let i = 0; i < listeners.length; i += 1) {
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
  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  return {
    ws,
    send: (data) => ws.send(JSON.stringify(data)),
    waitFor: (predicate, timeoutMs = 3000) => {
      for (let i = 0; i < queue.length; i += 1) {
        if (predicate(queue[i])) return Promise.resolve(queue.splice(i, 1)[0]);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = listeners.findIndex((entry) => entry.timer === timer);
          if (idx !== -1) listeners.splice(idx, 1);
          reject(new Error(`Timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        listeners.push({ predicate, resolve, timer });
      });
    }
  };
};

test("newbie quest chain runs end to end on the server", async (t) => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const gameSocket = initGameSocket(server, {
    path: "/ws",
    enemies: false,
    verifyToken: (token) => (token === "quest-token" ? "user_quest" : null),
    ownsCharacter: () => true,
    findCharacter: (_userId, characterId) => ({
      id: characterId,
      name: "Tân Thủ",
      gender: "male",
      faction: "han"
    })
  });

  const client = await createClient(`ws://127.0.0.1:${port}/ws`);
  t.after(async () => {
    client.ws.close();
    await new Promise((resolve) => server.close(resolve));
    gameSocket.close?.();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const spawn = npc("da-tau");
  client.send({
    type: "player_join",
    payload: {
      token: "quest-token",
      characterId: "char_quest_flow",
      mapId: "market",
      x: spawn.x,
      y: spawn.y
    }
  });
  await client.waitFor((m) => m.type === "init_world");
  const initialSync = await client.waitFor((m) => m.type === "quest_sync");
  assert.equal(initialSync.payload.activeId, null);

  const serverPlayer = () => gameSocket.playerById.get("char_quest_flow")?.data || null;

  const acceptRes = (() => {
    client.send({ type: "quest_accept", payload: { questId: "tan-thu-1", npcId: "da-tau" } });
    return client.waitFor((m) => m.type === "quest_result");
  })();
  const accepted = await acceptRes;
  assert.equal(accepted.payload.ok, true);
  const activeSync = await client.waitFor(
    (m) => m.type === "quest_sync" && m.payload.activeId === "tan-thu-1"
  );
  assert.equal(activeSync.payload.activeId, "tan-thu-1");

  // Talking from across the map is refused.
  const player = serverPlayer();
  player.x = 0;
  player.y = 0;
  client.send({ type: "quest_talk", payload: { npcId: "chu-tiem-vu-khi" } });
  const refused = await client.waitFor((m) => m.type === "quest_result");
  assert.equal(refused.payload.ok, false);
  assert.equal(refused.payload.reason, "range");

  const quest = questById("tan-thu-1");

  // A quest cannot be turned in before its objectives are heard.
  player.x = spawn.x;
  player.y = spawn.y;
  client.send({ type: "quest_turn_in", payload: { questId: "tan-thu-1", npcId: "da-tau" } });
  const tooEarly = await client.waitFor((m) => m.type === "quest_result");
  assert.equal(tooEarly.payload.ok, false);
  assert.equal(tooEarly.payload.reason, "incomplete");

  // Talking to the giver (not a target) records nothing.
  client.send({ type: "quest_talk", payload: { npcId: "da-tau" } });
  const notATarget = await client.waitFor((m) => m.type === "quest_result");
  assert.equal(notATarget.payload.ok, false);
  assert.equal(notATarget.payload.reason, "nothing");

  for (const target of quest.objectives[0].targets) {
    const def = npc(target.npcId);
    player.x = def.x;
    player.y = def.y;
    client.send({ type: "quest_talk", payload: { npcId: target.npcId } });
    const result = await client.waitFor((m) => m.type === "quest_result");
    assert.equal(result.payload.ok, true, target.npcId);
  }

  // Repeating the last conversation pays nothing extra.
  const last = quest.objectives[0].targets.at(-1);
  client.send({ type: "quest_talk", payload: { npcId: last.npcId } });
  const repeated = await client.waitFor((m) => m.type === "quest_result");
  assert.equal(repeated.payload.ok, false);
  assert.equal(repeated.payload.reason, "nothing");

  player.x = spawn.x;
  player.y = spawn.y;
  client.send({ type: "quest_turn_in", payload: { questId: "tan-thu-1", npcId: "da-tau" } });
  const turnedIn = await client.waitFor((m) => m.type === "quest_result");
  assert.equal(turnedIn.payload.ok, true);

  const doneSync = await client.waitFor(
    (m) => m.type === "quest_sync" && m.payload.completed?.includes("tan-thu-1")
  );
  assert.deepEqual(doneSync.payload.completed, ["tan-thu-1"]);
  assert.deepEqual(store.getQuestState("char_quest_flow").completed, ["tan-thu-1"]);

  // Replaying the turn-in is refused.
  client.send({ type: "quest_turn_in", payload: { questId: "tan-thu-1", npcId: "da-tau" } });
  const replay = await client.waitFor((m) => m.type === "quest_result");
  assert.equal(replay.payload.ok, false);
});
