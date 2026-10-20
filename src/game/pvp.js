/**
 * Pure rules for player-versus-player combat.
 *
 * The server owns every player's health: a client reports the damage number it
 * rolled, but the server validates flags/range/damage here before applying it to
 * the target's authoritative HP. Both the client (to gate the click) and the
 * server (to enforce) import this module so the rules never drift apart.
 */

import { WORLD_SCALE } from "./worldConfig.js";

/** Max distance (world px) at which one flagged player can strike another. */
export const PVP_ATTACK_RANGE = 110 * WORLD_SCALE;

/** Hard ceiling on a single reported hit, mirroring the server's enemy clamp. */
export const PVP_MAX_DAMAGE = 200;

/**
 * Decide whether one player is allowed to strike another.
 *
 * Both parties must carry the PK flag: a peaceful player can neither attack nor be
 * attacked, which keeps the flag meaningful as an explicit opt-in.
 *
 * @param {{id?:string, pkFlag?:boolean}|null} attacker
 * @param {{id?:string, pkFlag?:boolean}|null} target
 * @param {number} distance - world-space distance between the two players
 * @param {number} [maxRange=PVP_ATTACK_RANGE]
 * @returns {boolean}
 */
export function canPvpAttack(attacker, target, distance, maxRange = PVP_ATTACK_RANGE) {
  if (!attacker || !target) return false;

  const attackerId = attacker.id;
  const targetId = target.id;
  if (!attackerId || !targetId || attackerId === targetId) return false;

  if (attacker.pkFlag !== true || target.pkFlag !== true) return false;

  if (typeof distance !== "number" || !Number.isFinite(distance)) return false;
  return distance <= maxRange;
}

/**
 * Clamp an untrusted damage report into a usable whole number.
 * @param {*} damage
 * @returns {number|null} null when the value cannot be trusted
 */
export function clampPvpDamage(damage) {
  if (typeof damage !== "number" || !Number.isFinite(damage) || damage <= 0) return null;
  return Math.round(Math.min(damage, PVP_MAX_DAMAGE));
}
