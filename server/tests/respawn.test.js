import test from "node:test";
import assert from "node:assert/strict";
import { GameSocketManager } from "../src/websocket/gameSocket.js";
import { DEFAULT_MAP_ID, getMap } from "../../src/game/maps/mapRegistry.js";

/**
 * Bare manager with only the collaborators the respawn path touches, so the
 * home-city rule can be exercised without a live socket.
 * @param {string} victimMapId map the hero fell on
 */
function makeManager(victimMapId) {
  const victim = {
    id: "victim-1",
    username: "victim",
    displayName: "Nạn Nhân",
    characterId: "char_victim",
    mapId: victimMapId,
    x: 1234,
    y: 5678,
    hp: 0,
    maxHp: 100,
    mp: 0,
    maxMp: 50,
    vx: 10,
    vy: 20,
    lastX: 1234,
    lastY: 5678,
    lastMoveAt: 0,
    nextBiteAt: Date.now() + 5000,
    direction: "right",
    stance: "front",
    invulnerableUntil: 0
  };
  const localPeer = { id: "peer-old", mapId: victimMapId, x: 1200, y: 5600 };
  const cityPeer = { id: "peer-city", mapId: DEFAULT_MAP_ID, x: 100, y: 100 };

  /** @type {Array<{type:string, payload:Object}>} */
  const direct = [];
  /** @type {Array<{mapId:string, message:Object, excludeWs:?string}>} */
  const broadcast = [];

  const manager = Object.create(GameSocketManager.prototype);
  Object.assign(manager, {
    players: new Map([
      ["victim-ws", victim],
      ["peer-old-ws", localPeer],
      ["peer-city-ws", cityPeer]
    ]),
    playerById: new Map([["victim-1", { data: victim, ws: "victim-ws" }]]),
    rosterFor: () => new Map(),
    send: (_ws, message) => direct.push(message),
    broadcastToMap: (mapId, message, excludeWs = null) =>
      broadcast.push({ mapId, message, excludeWs }),
    broadcastMp: () => {},
    persistPosition: () => {},
    persistVitals: () => {},
    sendToAttackerOffMap: () => {}
  });

  return { manager, victim, direct, broadcast };
}

test("a hero who falls on a hunting map respawns in the home city", () => {
  const { manager, victim, direct, broadcast } = makeManager("dong-mon-thanh");
  const home = getMap(DEFAULT_MAP_ID);

  manager.respawnPlayer(victim, null, "wolf");

  assert.equal(victim.mapId, DEFAULT_MAP_ID, "the body is moved to the home city");
  assert.equal(victim.x, home.spawn.x);
  assert.equal(victim.y, home.spawn.y);
  assert.equal(victim.hp, victim.maxHp, "the hero returns at full health");
  assert.equal(victim.mp, victim.maxMp);

  const defeat = direct.find((message) => message.type === "player_defeated");
  assert.ok(defeat, "the victim is told about the defeat");
  assert.deepEqual(defeat.payload.respawn, {
    mapId: DEFAULT_MAP_ID,
    x: home.spawn.x,
    y: home.spawn.y
  });

  const changed = direct.find((message) => message.type === "map_changed");
  assert.ok(changed, "the victim receives the new map");
  assert.equal(changed.payload.mapId, DEFAULT_MAP_ID);
  assert.deepEqual(
    changed.payload.players.map((peer) => peer.id),
    ["peer-city"],
    "only the home city's peers are sent"
  );

  const left = broadcast.find((entry) => entry.message.type === "player_left");
  assert.ok(left, "the map the hero fell on drops the body");
  assert.equal(left.mapId, "dong-mon-thanh");

  const joined = broadcast.find((entry) => entry.message.type === "player_joined");
  assert.ok(joined, "the home city sees the hero arrive");
  assert.equal(joined.mapId, DEFAULT_MAP_ID);
  assert.equal(joined.message.payload.player.id, victim.id);
});

test("a hero who falls in the home city stays on that map", () => {
  const { manager, victim, direct, broadcast } = makeManager(DEFAULT_MAP_ID);
  const home = getMap(DEFAULT_MAP_ID);

  manager.respawnPlayer(victim, null, "pvp");

  assert.equal(victim.mapId, DEFAULT_MAP_ID);
  assert.equal(victim.x, home.spawn.x);
  assert.equal(victim.y, home.spawn.y);

  assert.equal(
    broadcast.filter((entry) => entry.message.type === "player_left").length,
    0,
    "no map change is announced"
  );
  assert.equal(
    direct.filter((message) => message.type === "map_changed").length,
    0,
    "the victim keeps its current map"
  );

  const moved = broadcast.find((entry) => entry.message.type === "player_moved");
  assert.ok(moved, "watchers see the body snapped to the spawn");
  assert.equal(moved.message.payload.id, victim.id);
});

test("a Thục hero respawns in Thục Thành, not Biện Kinh", () => {
  const { manager, victim, direct } = makeManager("trung-nguyen");
  victim.faction = "thuc";
  const home = getMap("thuc-thanh");

  manager.respawnPlayer(victim, null, "pvp");

  assert.equal(victim.mapId, "thuc-thanh");
  assert.equal(victim.x, home.spawn.x);
  assert.equal(victim.y, home.spawn.y);

  const defeat = direct.find((message) => message.type === "player_defeated");
  assert.deepEqual(defeat.payload.respawn, {
    mapId: "thuc-thanh",
    x: home.spawn.x,
    y: home.spawn.y
  });
});
