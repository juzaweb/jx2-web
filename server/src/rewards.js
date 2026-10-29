/**
 * Authoritative kill-reward roll. Enemy health, death and respawn are owned by
 * GameSocketManager, so the reward for a kill is rolled here from the same shared
 * monster catalog the client uses (see src/game/enemyCatalog.js) instead of by
 * whichever client happened to cross 0 HP.
 */

import {
  getMonster,
  rewardForMonster,
  weaponDropFor
} from "../../src/game/enemyCatalog.js";

/**
 * Draw one rng value in [0, 1), accepting either a function or a constant so
 * tests can pin the roll.
 * @param {Function|number} rng
 * @returns {number}
 */
const drawRoll = (rng) => {
  const value = typeof rng === "function" ? rng() : rng;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 0.999999)
    : 0;
};

/**
 * Roll the weapon (if any) a monster leaves behind. Skills are learned from the
 * F5 tree, so this is the only item a kill can still leave behind.
 * @param {string} monsterId
 * @param {Function|number} [rng=Math.random]
 * @returns {{ itemId: string }|null}
 */
export const rollWeaponDrop = (monsterId, rng = Math.random) => {
  const drop = weaponDropFor(monsterId);
  if (!drop) return null;
  if (drawRoll(rng) >= drop.chance) return null;
  return { itemId: drop.itemId };
};

/**
 * Roll the reward for a defeated enemy. Kills pay EXP, coins (counted in đồng,
 * the ledger base unit) and, rarely, a weapon.
 * @param {string} attackerId - id of the player whose hit landed the killing blow
 * @param {{id:number, mapId?:string, monsterId?:string, x:number, y:number}} enemy
 * @param {Function|number} [rng=Math.random]
 * @returns {{ enemyId:number, attackerId:string, monsterId:string, name:string,
 *   level:number, x:number, y:number, exp:number, coins:number,
 *   loot: Array<{ itemId: string }> }}
 */
export const rollEnemyReward = (attackerId, enemy, rng = Math.random) => {
  const monster = getMonster(enemy.monsterId);
  // Coins first so a sequence-based rng keeps the historical coin roll, then the
  // rarer weapon chance.
  const payout = rewardForMonster(monster, rng);
  const weapon = rollWeaponDrop(monster.id, rng);

  return {
    enemyId: enemy.id,
    attackerId,
    monsterId: monster.id,
    name: monster.name,
    level: monster.level,
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    ...payout,
    loot: [weapon].filter(Boolean)
  };
};
