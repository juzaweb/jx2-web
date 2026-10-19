/**
 * Skill table shared by the client and the server.
 *
 * The MP cost of a skill is authoritative data: the server spends it from the
 * player's server-owned MP pool, and the client only predicts the same number so
 * the two never disagree about what a cast costs.
 */

/** MP cost per skill id. Skills not listed are free. */
export const SKILL_MP_COST = {
  kiem_khi: 15
};

/**
 * @param {string} skill
 * @returns {number}
 */
export function skillMpCost(skill) {
  // Own-property check so inherited keys (`__proto__`, `constructor`) read as
  // free rather than leaking a prototype object into the cost.
  return Object.prototype.hasOwnProperty.call(SKILL_MP_COST, skill)
    ? SKILL_MP_COST[skill]
    : 0;
}
