import test from "node:test";
import assert from "node:assert/strict";
import { GameSocketManager } from "../src/websocket/gameSocket.js";

/**
 * Build a bare manager with only the collaborators `handleEnemyHit` touches, so
 * the authoritative splash path can be exercised without a live socket.
 */
function makeManager({ enemies, castSkillId, playerWeapon = "bao-tay" }) {
  const now = Date.now();
  const roster = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const player = {
    id: "player-1",
    weaponType: playerWeapon,
    level: 10,
    learnedSkills: ["la_han_quyen", "dai_tu_di_chuong"],
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

test("Kiếm Khí's blast splashes reduced damage onto monsters caught in it", () => {
  const primary = wolf("primary", 100);
  const nearby = wolf("nearby", 250);
  const far = wolf("far", 1000);
  const { manager } = makeManager({
    enemies: [primary, nearby, far],
    castSkillId: "kiem_khi",
    playerWeapon: "kiem"
  });

  manager.handleEnemyHit("ws", { id: "primary", skill: "kiem_khi" });

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
