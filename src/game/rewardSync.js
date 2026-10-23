/**
 * Validation layer for the server's `enemy_reward` broadcast (see
 * server/src/rewards.js). Enemy health is server-owned, so the reward for a kill
 * is rolled there; this module converts the untrusted payload into a safe reward
 * object and rejects anything malformed before stats are touched.
 */

import { DROP_TABLE_MAP } from "./items.js";

/**
 * @typedef {Object} EnemyReward
 * @property {number|string|undefined} enemyId
 * @property {string|null} attackerId
 * @property {number|null} x
 * @property {number|null} y
 * @property {number} exp
 * @property {number} coins
 * @property {string} [name] Display name of the defeated monster, when sent
 */

/**
 * Coerce a value into a non-negative whole number, or null when it is not a
 * finite number, so a negative or NaN payout can never be applied.
 * @param {*} value
 * @returns {number|null}
 */
const toCount = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
};

/**
 * Normalize one authoritative kill-reward payload.
 * @param {Object} payload
 * @returns {EnemyReward|null} null when the payload cannot be trusted
 */
export function parseEnemyReward(payload = {}) {
  if (!payload || typeof payload !== "object") return null;

  const exp = toCount(payload.exp);
  const coins = toCount(payload.coins);
  if (exp === null || coins === null) return null;

  // Ignore any stale or forged loot payload. Kills pay EXP + bạc only, and the
  // reward object must stay free of item data that could be replayed into the bag.
  if (payload.drop && typeof payload.drop === "object") {
    const dropId = payload.drop.id;
    if (typeof dropId === "string" && !DROP_TABLE_MAP.has(dropId)) {
      // no-op: formatted reward remains item-free even when a forged drop arrives.
    }
  }

  const reward = {
    enemyId: payload.enemyId,
    attackerId: typeof payload.attackerId === "string" ? payload.attackerId : null,
    x: Number.isFinite(payload.x) ? payload.x : null,
    y: Number.isFinite(payload.y) ? payload.y : null,
    exp,
    coins
  };

  // Optional: lets the combat log name the monster. Omitted entirely when absent,
  // so the historical payload shape is unchanged.
  if (typeof payload.name === "string" && payload.name.length > 0) {
    reward.name = payload.name;
  }

  return reward;
}
