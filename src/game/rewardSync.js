/**
 * Validation layer for the server's `enemy_reward` broadcast (see
 * server/src/rewards.js). Enemy health is server-owned, so the reward for a kill
 * is rolled there; this module converts the untrusted payload into a safe reward
 * object and rejects anything malformed before stats or inventory are touched.
 */

import { DROP_TABLE } from "./items.js";

/**
 * @typedef {Object} EnemyReward
 * @property {number|string|undefined} enemyId
 * @property {string|null} attackerId
 * @property {number|null} x
 * @property {number|null} y
 * @property {number} exp
 * @property {number} coins
 * @property {{ id: string, name: string, qty: number }|null} drop
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

  // Only catalog loot may be granted, and the quantity comes from the shared
  // table rather than from the payload.
  const entry = DROP_TABLE.find((item) => item.id === payload.drop?.id);

  return {
    enemyId: payload.enemyId,
    attackerId: typeof payload.attackerId === "string" ? payload.attackerId : null,
    x: Number.isFinite(payload.x) ? payload.x : null,
    y: Number.isFinite(payload.y) ? payload.y : null,
    exp,
    coins,
    drop: entry ? { id: entry.id, name: entry.name, qty: entry.qty } : null
  };
}
