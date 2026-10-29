import test from "node:test";
import assert from "node:assert/strict";
import { GameSocketManager } from "../src/websocket/gameSocket.js";

/**
 * Build a bare manager with only the collaborators `handleEnemyHit` touches, so
 * the authoritative splash path can be exercised without a live socket.
 */
function makeManager({ enemies, castSkillId, playerWeapon = "bao-tay", skillLevels = {} }) {
  const now = Date.now();
  const roster = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const player = {
    id: "player-1",
    weaponType: playerWeapon,
    // High enough for every fist art used here (la_han_quyen needs 18).
    level: 40,
    learnedSkills: ["la_han_quyen", "dai_tu_di_chuong"],
    skillLevels,
    mapId: "dong-mon-thanh",
    x: 0,
    y: 0,
    characterId: null,
    lastCast: { skillId: castSkillId, at: now, hits: 0, aim: null }
  };
  const broadcasts = [];

  const manager = Object.create(GameSocketManager.prototype);
  Object.assign(manager, {
    players: new Map([["ws", player]]),
    rosterFor: () => roster,
    effectiveStats: () => ({ attack: 100, critRate: 0, critDamage: 1.5 }),
    random: () => 0.5,
    send: () => {},
    broadcastToMap: (_mapId, message) => broadcasts.push(message),
    gridFor: () => ({ remove: () => {} }),
    scheduleEnemyRespawn: () => {},
    creditReward: () => {},
    persistProgress: () => {},
    enemySnapshot: (enemy) => ({
      id: enemy.id,
      hp: enemy.hp,
      x: enemy.x,
      y: enemy.y,
      isDead: enemy.isDead
    })
  });

  return { manager, player, broadcasts, roster };
}

const wolf = (id, x) => ({
  id,
  mapId: "dong-mon-thanh",
  x,
  y: 0,
  hp: 1000,
  maxHp: 1000,
  defense: 0,
  isDead: false
});

test("La Hán Quyền splashes a landed punch onto nearby monsters", () => {
  const primary = wolf("primary", 100);
  const nearby = wolf("nearby", 200);
  const far = wolf("far", 1000);
  const { manager, broadcasts } = makeManager({
    enemies: [primary, nearby, far],
    castSkillId: "la_han_quyen"
  });

  manager.handleEnemyHit("ws", { id: "primary", skill: "la_han_quyen" });

  assert.ok(primary.hp < 1000, "the primary target is damaged");
  assert.ok(nearby.hp < 1000, "a monster inside the splash radius is damaged");
  assert.equal(far.hp, 1000, "a monster outside the splash radius is untouched");
  assert.equal(
    broadcasts.filter((message) => message.type === "enemy_hit").length,
    2,
    "one enemy_hit broadcast per damaged monster"
  );
});

test("a single-target skill does not splash", () => {
  const primary = wolf("primary", 100);
  const nearby = wolf("nearby", 200);
  const { manager } = makeManager({
    enemies: [primary, nearby],
    castSkillId: "dai_tu_di_chuong"
  });

  manager.handleEnemyHit("ws", { id: "primary", skill: "dai_tu_di_chuong" });

  assert.ok(primary.hp < 1000);
  assert.equal(nearby.hp, 1000);
});

test("La Hán Quyền's splash only deals a fraction of the primary hit", () => {
  const primary = wolf("primary", 100);
  const nearby = wolf("nearby", 250);
  const far = wolf("far", 1000);
  const { manager } = makeManager({
    enemies: [primary, nearby, far],
    castSkillId: "la_han_quyen"
  });

  manager.handleEnemyHit("ws", { id: "primary", skill: "la_han_quyen" });

  const primaryDamage = 1000 - primary.hp;
  const splashDamage = 1000 - nearby.hp;
  assert.ok(primaryDamage > 0, "the aimed monster takes the full hit");
  assert.ok(splashDamage > 0, "a monster inside the burst is damaged too");
  assert.ok(
    splashDamage < primaryDamage,
    "the burst only deals a fraction of the primary hit"
  );
  assert.equal(far.hp, 1000, "a monster outside the burst is untouched");
});

test("a levelled skill scales the primary and the splash by the same factor", () => {
  // The splash is a fixed fraction of the strike's multiplier. Passing an
  // already-leveled skill *and* a level would scale it twice, so the fraction
  // must stay constant as the skill levels up.
  const run = (level) => {
    const primary = wolf("primary", 100);
    const nearby = wolf("nearby", 250);
    const { manager } = makeManager({
      enemies: [primary, nearby],
      castSkillId: "la_han_quyen",
      skillLevels: { la_han_quyen: level }
    });

    manager.handleEnemyHit("ws", { id: "primary", skill: "la_han_quyen" });
    return { primary: 1000 - primary.hp, splash: 1000 - nearby.hp };
  };

  const base = run(1);
  const maxed = run(10);
  assert.ok(maxed.primary > base.primary, "the primary hit grows with the level");
  assert.ok(maxed.splash > base.splash, "the splash grows with the level too");
  assert.ok(
    Math.abs(maxed.splash / maxed.primary - base.splash / base.primary) < 0.02,
    "the splash stays the same fraction of the primary hit"
  );
});
