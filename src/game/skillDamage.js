/**
 * Pure skill-damage and buff maths shared by the client (`combat.js`) and the
 * server (`gameSocket.js`), so both sides agree on how hard a skill hits.
 */

import { computeDamage } from "./damage.js";

/**
 * Damage multiplier for a skill. Non-damaging skills (buffs/heals) expose `mult: 0`.
 * @param {Object} skill
 * @returns {number}
 */
export function skillMultiplier(skill) {
  const mult = Number(skill?.mult);
  return Number.isFinite(mult) && mult > 0 ? mult : 0;
}

/**
 * Compute a skill hit against a defender.
 * @param {Object} skill
 * @param {Object} attacker
 * @param {Object} defender
 * @param {Function|number} [rng=Math.random]
 * @returns {{ damage: number, crit: boolean }}
 */
export function computeSkillDamage(skill, attacker, defender, rng = Math.random) {
  const mult = skillMultiplier(skill);
  if (mult <= 0) return { damage: 0, crit: false };
  return computeDamage(attacker, defender, rng, { skillMult: mult });
}

/**
 * Apply active timed buffs to a base stats object without mutating it.
 * Supported buff stats: `attackPct`, `defensePct`, `critRate` (flat added).
 * Expired entries are ignored.
 *
 * @param {Object} stats
 * @param {Array<{stat:string, amount:number, until:number}>} [buffs]
 * @param {number} [now]
 * @returns {Object} a copy of `stats` with buffs applied
 */
export function applyBuffsToStats(stats = {}, buffs = [], now = Date.now()) {
  const result = { ...stats };
  for (const buff of buffs) {
    if (!buff || typeof buff.until === "number" && buff.until <= now) continue;
    const amount = Number(buff.amount) || 0;
    if (buff.stat === "attackPct") {
      result.attack = Math.round((result.attack || 0) * (1 + amount));
    } else if (buff.stat === "defensePct") {
      result.defense = Math.round((result.defense || 0) * (1 + amount));
    } else if (buff.stat === "critRate") {
      result.critRate = Math.min(1, (result.critRate || 0) + amount);
    }
  }
  return result;
}
