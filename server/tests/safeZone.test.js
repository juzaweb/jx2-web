import test from "node:test";
import assert from "node:assert/strict";
import { GameSocketManager } from "../src/websocket/gameSocket.js";

/**
 * Bare manager with only the collaborators the early safe-zone guards touch, so
 * the city combat ban can be exercised without a live socket.
 * @returns {{manager: GameSocketManager, messages: Array<object>, attacker: Object, target: Object}}
 */
function makeManager() {
  const attacker = {
    id: "attacker-1",
    mapId: "market",
    x: 0,
    y: 0,
    pkFlag: true
  };
  const target = {
    id: "target-1",
    mapId: "market",
    x: 10,
    y: 0,
    hp: 100,
    maxHp: 100,
    pkFlag: true
  };
  const messages = [];

  const manager = Object.create(GameSocketManager.prototype);
  Object.assign(manager, {
    combatSafeZones: true,
    players: new Map([["ws", attacker]]),
    playerById: new Map([["target-1", { data: target, ws: "target-ws" }]]),
    send: (_ws, message) => messages.push(message)
  });

  return { manager, messages, attacker, target };
}

test("the home city is a no-combat safe zone", async (t) => {
  await t.test("a PvP strike is rejected with a reason the client can explain", () => {
    const { manager, messages } = makeManager();

    manager.handlePlayerHit("ws", { targetId: "target-1" });

    assert.deepEqual(messages.at(-1), {
      type: "player_hit_rejected",
      payload: { reason: "safe_zone" }
    });
  });

  await t.test("a swing or cast is refused before it can authorise a hit", () => {
    const { manager, messages } = makeManager();

    manager.handlePlayerAttack("ws", { skill: "normal" });

    assert.equal(messages.at(-1)?.type, "player_hit_rejected");
    assert.equal(messages.at(-1)?.payload?.reason, "safe_zone");
  });

  await t.test("a monster hit never reaches the city roster", () => {
    const { manager } = makeManager();
    let rosterRead = false;
    manager.rosterFor = () => {
      rosterRead = true;
      return new Map();
    };

    manager.handleEnemyHit("ws", { id: 0 });

    assert.equal(rosterRead, false, "the city roster is never consulted");
  });

  await t.test("every other map keeps fighting, and the harness can opt out", () => {
    const { manager, attacker } = makeManager();

    assert.equal(manager.canFightHere(attacker), false, "Biện Kinh is the safe city");

    attacker.mapId = "dong-mon-thanh";
    assert.equal(manager.canFightHere(attacker), true, "the hunting ground is a combat map");

    attacker.mapId = "market";
    manager.combatSafeZones = false;
    assert.equal(manager.canFightHere(attacker), true, "the legacy harness opts out");
  });
});
