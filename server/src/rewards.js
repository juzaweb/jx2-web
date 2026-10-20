/**
 * Authoritative kill-reward roll. Enemy health, death and respawn are owned by
 * GameSocketManager, so the reward for a kill is rolled here from the same shared
 * catalog the client uses (see src/game/items.js) instead of by whichever client
 * happened to cross 0 HP.
 */

import { rollKillReward } from "../../src/game/items.js";

/**
 * Roll the reward for a defeated enemy.
 * @param {string} attackerId - id of the player whose hit landed the killing blow
 * @param {{id:number, x:number, y:number}} enemy
 * @param {Function|number} [rng=Math.random]
 * @returns {{ enemyId:number, attackerId:string, x:number, y:number, exp:number, coins:number, drop:{id:string, qty:number} }}
 */
export const rollEnemyReward = (attackerId, enemy, rng = Math.random) => ({
  enemyId: enemy.id,
  attackerId,
  x: Math.round(enemy.x),
  y: Math.round(enemy.y),
  ...rollKillReward(rng)
});
