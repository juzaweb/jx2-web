import test from "node:test";
import assert from "node:assert/strict";
import { GameSocketManager } from "../src/websocket/gameSocket.js";

const TARGET_HP = 5000;

/**
 * Bare manager with only the collaborators the PvP hit path touches, so the
 * i-frame policy can be exercised without a live socket.
 */
function makeManager(skillId, { others = [] } = {}) {
  const attacker = {
    id: "attacker-1",
    weaponType: "bao-tay",
    level: 10,
    learnedSkills: ["la_han_quyen", "dai_tu_di_chuong", "nhu_lai_than_chuong"],
    mapId: "dong-mon-thanh",
    x: 0,
    y: 0,
    pkFlag: true,
    nextHitAt: 0,
    lastCast: { skillId, at: Date.now(), hits: 0, aim: { x: 100, y: 0 } }
  };
  const target = {
    id: "target-1",
    mapId: "dong-mon-thanh",
    x: 100,
    y: 0,
    hp: TARGET_HP,
    maxHp: TARGET_HP,
    defense: 0,
    pkFlag: true,
    invulnerableUntil: 0,
    buffs: []
  };
  const others_ = others.map((other, index) => ({ ws: `other-${index}-ws`, data: other }));
  const messages = [];

  const manager = Object.create(GameSocketManager.prototype);
  Object.assign(manager, {
    players: new Map([
      ["attacker-ws", attacker],
      ["target-ws", target],
      ...others_.map(({ ws, data }) => [ws, data])
    ]),
    playerById: new Map([
      ["target-1", { data: target, ws: "target-ws" }],
      ...others_.map(({ ws, data }) => [data.id, { data, ws }])
    ]),
    effectiveStats: () => ({ attack: 100, defense: 0, critRate: 0, critDamage: 1.5 }),
    // 0.99: no crit, no variance swing, and no directional dodge.
    random: () => 0.99,
    send: (_ws, message) => messages.push(message),
    broadcastPlayerState: () => {},
    sendToAttackerOffMap: () => {},
    persistVitals: () => {},
    respawnPlayer: () => {}
  });

  const strike = () =>
    manager.handlePlayerHit("attacker-ws", { targetId: "target-1", skill: skillId });

  return { manager, attacker, target, messages, strike };
}

test("a channelled skill punches through the target's i-frame", () => {
  const { attacker, target, messages, strike } = makeManager("la_han_quyen");

  strike();
  const afterFirst = target.hp;
  // Simulate the next channel tick arriving one interval later.
  attacker.lastCast.lastHitAt = Date.now() - 250;
  strike();

  assert.ok(afterFirst < TARGET_HP, "the first punch lands");
  assert.ok(target.hp < afterFirst, "the second punch lands despite the 700ms i-frame");
  assert.equal(target.invulnerableUntil, 0, "channel ticks do not open a new i-frame");
  assert.equal(
    messages.filter((message) => message.payload?.reason === "iframe").length,
    0,
    "no punch is rejected as iframe"
  );
});

test("a one-shot skill still respects the target's i-frame", () => {
  const { attacker, target, messages, strike } = makeManager("dai_tu_di_chuong");

  strike();
  const afterFirst = target.hp;
  // Isolate the i-frame from the per-attacker rate limit.
  attacker.nextHitAt = 0;
  strike();

  assert.equal(target.hp, afterFirst, "the second hit is swallowed by the i-frame");
  assert.ok(target.invulnerableUntil > 0, "the one-shot hit opens an i-frame");
  assert.equal(
    messages.filter((message) => message.payload?.reason === "iframe").length,
    1,
    "the attacker is told the hit was refused"
  );
});

test("a short-range skill cannot hit a player beyond its own reach", () => {
  const { target, messages, strike } = makeManager("la_han_quyen");
  // Inside PvP range (1140) but well beyond La Hán Quyền's 300 reach.
  target.x = 500;

  strike();

  assert.equal(target.hp, TARGET_HP);
  assert.equal(
    messages.filter((message) => message.payload?.reason === "range").length,
    1,
    "the out-of-reach skill hit is rejected"
  );
});

test("a landed punch splashes onto nearby flagged players, not peaceful ones", () => {
  const bystander = {
    id: "bystander-1",
    mapId: "dong-mon-thanh",
    x: 200,
    y: 0,
    hp: TARGET_HP,
    maxHp: TARGET_HP,
    defense: 0,
    pkFlag: true,
    buffs: []
  };
  const peaceful = {
    id: "peaceful-1",
    mapId: "dong-mon-thanh",
    x: 210,
    y: 0,
    hp: TARGET_HP,
    maxHp: TARGET_HP,
    defense: 0,
    pkFlag: false,
    buffs: []
  };
  const { target, strike } = makeManager("la_han_quyen", { others: [bystander, peaceful] });

  strike();

  assert.ok(target.hp < TARGET_HP, "the primary target is damaged");
  assert.ok(bystander.hp < TARGET_HP, "a flagged player inside the radius is damaged");
  assert.equal(peaceful.hp, TARGET_HP, "a peaceful player is not dragged into PvP");
});

test("an AoE skill lands on a flagged player inside its cast area", () => {
  const { target, strike } = makeManager("nhu_lai_than_chuong");
  target.x = 200; // cast centre is (100, 0), radius 900

  strike();

  assert.ok(target.hp < TARGET_HP);
});

test("an AoE skill refuses a player outside its cast area", () => {
  const { target, messages, strike } = makeManager("nhu_lai_than_chuong");
  // Beyond the 900 radius but still inside PvP range (1140).
  target.x = 1100;

  strike();

  assert.equal(target.hp, TARGET_HP);
  assert.equal(
    messages.filter((message) => message.payload?.reason === "range").length,
    1,
    "the out-of-area hit is rejected"
  );
});
