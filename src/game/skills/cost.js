/**
 * Casting costs: MP and cooldown, plus the test-mode overrides that zero both
 * so the client gate and the authoritative server check cannot drift apart.
 */

import { isTestMode } from "../testMode.js";
import { SKILLS_BY_ID } from "./registry.js";

/**
 * MP cost of a skill id. Unknown ids are free, which keeps `normal` and legacy
 * ids from ever charging mana.
 * @param {string} skill
 * @returns {number}
 */
export function skillMpCost(skill) {
  const entry = SKILLS_BY_ID.get(skill);
  return entry ? entry.mp : 0;
}

/**
 * Cooldown (ms) of a skill id.
 * @param {string} skill
 * @returns {number}
 */
export function skillCooldown(skill) {
  const entry = SKILLS_BY_ID.get(skill);
  return entry ? entry.cooldown : 0;
}

/**
 * MP a cast actually spends.
 *
 * This is the one place test mode waives a casting cost, so the client's hotbar
 * gate and the server's authoritative check cannot drift apart: in test mode a
 * skill is effectively free.
 * @param {string} skill skill id
 * @returns {number} MP to spend (0 in test mode)
 */
export function effectiveSkillMpCost(skill) {
  return isTestMode() ? 0 : skillMpCost(skill);
}

/**
 * Cooldown (ms) a cast actually starts.
 *
 * In test mode every skill is ready immediately, so nothing is ever put on
 * cooldown and the hotbar shows no recovery scrim.
 * @param {string} skill
 * @returns {number} cooldown in ms (0 in test mode)
 */
export function effectiveSkillCooldown(skill) {
  return isTestMode() ? 0 : skillCooldown(skill);
}
