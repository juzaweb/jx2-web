/**
 * Health regeneration granted by a weapon's passive internal arts (tâm pháp).
 *
 * Passive skills (`passive: true`) are never cast: once learned they are always
 * running and restore health on their own. This module keeps that maths pure and
 * framework-free so the game loop only has to feed it elapsed time.
 */

import { skillsForWeapon, skillPassiveRegen, skillUsable } from "./skills.js";

/**
 * HP per second restored by one skill's `regen` effects.
 * @param {Object} skill
 * @returns {number}
 */
export function regenPerSecond(skill) {
  return skillPassiveRegen(skill);
}

/**
 * Summed HP/s of every passive skill a weapon's kit grants at `level`.
 * Unknown weapons and unlearned passives contribute nothing.
 * @param {string} weapon
 * @param {number} [level=1]
 * @param {Iterable<string>|Set<string>|null} [learned=null] learned skill ids
 * @returns {number}
 */
export function passiveRegenRate(weapon, level = 1, learned = null) {
  let rate = 0;
  for (const skill of skillsForWeapon(weapon)) {
    if (skill?.passive !== true) continue;
    if (!skillUsable(skill, level, learned)) continue;
    rate += regenPerSecond(skill);
  }
  return rate;
}

/**
 * Advance the regen accumulator by `deltaMs` of elapsed time.
 *
 * The fractional remainder is carried forward, so a rate slower than 1 HP per
 * frame still delivers whole HP points at a steady cadence instead of never
 * rounding up.
 *
 * @param {number} carry fractional HP left over from the previous tick
 * @param {number} rate HP per second
 * @param {number} deltaMs elapsed milliseconds
 * @returns {{ carry: number, amount: number }} new remainder and whole HP to heal
 */
export function advanceRegen(carry, rate, deltaMs) {
  const safeCarry = Number.isFinite(carry) && carry > 0 ? carry : 0;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  const safeDelta = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;

  const total = safeCarry + (safeRate * safeDelta) / 1000;
  const amount = Math.floor(total);
  return { carry: total - amount, amount };
}

/**
 * Longest gap one regen tick may bill. A paused scene, a background tab or a
 * debugger stop leaves a huge gap between two frames; billing all of it would
 * heal the hero to full the moment play resumes.
 */
export const MAX_TICK_MS = 1000;

/**
 * Elapsed time a single tick may bill, or 0 when the gap is not a normal frame.
 * @param {number|null} previousAt timestamp of the previous tick (null on the first)
 * @param {number} now current timestamp
 * @returns {number} milliseconds to bill, 0 for the first frame and for a stall
 */
export function billableDeltaMs(previousAt, now) {
  if (!Number.isFinite(previousAt) || !Number.isFinite(now)) return 0;
  const deltaMs = now - previousAt;
  return deltaMs > 0 && deltaMs <= MAX_TICK_MS ? deltaMs : 0;
}
