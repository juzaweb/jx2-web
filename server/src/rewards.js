/**
 * Authoritative kill-reward roll. Enemy health, death and respawn are owned by
 * GameSocketManager, so the reward for a kill is rolled here from the same shared
 * monster catalog the client uses (see src/game/enemyCatalog.js) instead of by
 * whichever client happened to cross 0 HP.
 */

import { bookDropsFor, getMonster, rewardForMonster } from "../../src/game/enemyCatalog.js";
import { bookItemId } from "../../src/game/items.js";

/**
 * Roll the skill book (if any) a monster leaves behind. Uses at most two rng
 * draws: one for the drop chance and one for which book in the pool.
 * @param {string} monsterId
 * @param {Function|number} [rng=Math.random]
 * @returns {{ itemId: string, skillId: string }|null}
 */
export const rollBookDrop = (monsterId, rng = Math.random) => {
  const group = bookDropsFor(monsterId);
  if (!group || !group.skills.length) return null;

  const draw = () => {
    const value = typeof rng === "function" ? rng() : rng;
    return typeof value === "number" && Number.isFinite(value)
      ? Math.min(Math.max(value, 0), 0.999999)
      : 0;
  };

  if (draw() >= group.chance) return null;
  const skillId = group.skills[Math.floor(draw() * group.skills.length)];
  return { itemId: bookItemId(skillId), skillId };
};

/**
 * Roll the reward for a defeated enemy. Kills pay EXP, bạc and, occasionally, a
 * skill book.
 * @param {string} attackerId - id of the player whose hit landed the killing blow
 * @param {{id:number, mapId?:string, monsterId?:string, x:number, y:number}} enemy
 * @param {Function|number} [rng=Math.random]
 * @returns {{ enemyId:number, attackerId:string, monsterId:string, name:string,
 *   level:number, x:number, y:number, exp:number, coins:number,
 *   loot: Array<{ itemId: string, skillId: string }> }}
 */
export const rollEnemyReward = (attackerId, enemy, rng = Math.random) => {
  const monster = getMonster(enemy.monsterId);
  // Coins first so a sequence-based rng keeps the historical coin roll, then the
  // book chance.
  const payout = rewardForMonster(monster, rng);
  const book = rollBookDrop(monster.id, rng);

  return {
    enemyId: enemy.id,
    attackerId,
    monsterId: monster.id,
    name: monster.name,
    level: monster.level,
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    ...payout,
    loot: book ? [book] : []
  };
};
