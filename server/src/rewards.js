/**
 * Authoritative kill-reward roll. Enemy health, death and respawn are owned by
 * GameSocketManager, so the reward for a kill is rolled here from the same shared
 * monster catalog the client uses (see src/game/enemyCatalog.js) instead of by
 * whichever client happened to cross 0 HP.
 */

import { getMonster, rewardForMonster } from "../../src/game/enemyCatalog.js";

/**
 * Roll the reward for a defeated enemy. Kills pay EXP and bạc only — there is no
 * loot table, so nothing is dropped into the world.
 * @param {string} attackerId - id of the player whose hit landed the killing blow
 * @param {{id:number, mapId?:string, monsterId?:string, x:number, y:number}} enemy
 * @param {Function|number} [rng=Math.random]
 * @returns {{ enemyId:number, attackerId:string, monsterId:string, name:string, level:number, x:number, y:number, exp:number, coins:number }}
 */
export const rollEnemyReward = (attackerId, enemy, rng = Math.random) => {
  const monster = getMonster(enemy.monsterId);

  return {
    enemyId: enemy.id,
    attackerId,
    monsterId: monster.id,
    name: monster.name,
    level: monster.level,
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    ...rewardForMonster(monster, rng)
  };
};
