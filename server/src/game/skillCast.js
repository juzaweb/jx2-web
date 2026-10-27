/**
 * Pure server-side skill cast rules.
 *
 * Extracted from the WebSocket server so cast validation, self-effect
 * application and damage authorization can be unit-tested without a socket,
 * a live world, or a database. Every function here takes plain objects and
 * mutates only the state it is handed (the cast's hit budget, the player's
 * buffs/HP), never transport or storage.
 *
 * The client shares the same catalog and maths through `src/game/skills.js`, so
 * both sides cannot drift apart.
 */

import {
  applySelfEffects,
  isInsideCastArea,
  skillById,
  skillLearnable,
  skillLockReason,
  skillUsable
} from "../../../src/game/skills.js";
import { HIT_WINDOW_MS, consumeCastHit, splashMultiplier } from "../../../src/game/combatRules.js";
import { computeDamage } from "../../../src/game/damage.js";
import { computeSkillDamage } from "../../../src/game/skillDamage.js";

/** Re-exported so callers only need this module for cast-area checks. */
export { isInsideCastArea };

/**
 * Why a cast request must be refused, or null when it is allowed.
 *
 * Order matters and mirrors the client: a passive is never castable, a skill
 * from another weapon kit is refused, then level/learned gates apply.
 *
 * @param {Object|null|undefined} skill resolved catalog entry (or null for a swing)
 * @param {{ weaponType?: string, level: number, learnedSkills?: string[] }} player
 * @returns {"passive"|"weapon"|"locked"|null}
 */
export function castRejection(skill, player) {
  if (!skill) return null;
  if (skill.passive) return "passive";
  if (skill.weapon !== player.weaponType) return "weapon";
  if (!skillUsable(skill, player.level, player.learnedSkills)) return "locked";
  return null;
}

/**
 * Why a skill book cannot be studied, or null when it can.
 *
 * @param {Object|null|undefined} skill resolved catalog entry
 * @param {number} level character level
 * @param {string[]} [learned] learned skill ids
 * @returns {{ reason: "not_usable"|"already_learned"|"level"|"prereq",
 *   level?: number, prereqId?: string|null }|null}
 */
export function studyRejection(skill, level, learned = []) {
  if (!skill) return { reason: "not_usable" };

  const known = Array.isArray(learned) ? learned : [];
  if (skill.starter || known.includes(skill.id)) return { reason: "already_learned" };

  if (!skillLearnable(skill, level, known)) {
    const lock = skillLockReason(skill, level, known);
    return {
      reason: lock?.kind === "level" ? "level" : "prereq",
      level: lock?.level ?? skill.unlockLevel,
      prereqId: lock?.id || null
    };
  }

  return null;
}

/**
 * Apply a cast's self-targeted effects (buff, heal) to a server player object.
 * Broadcasting and persistence stay with the caller.
 *
 * @param {{ hp: number, maxHp: number, buffs?: Object[] }} player
 * @param {Object} skill
 * @param {number} now
 * @returns {{ statsChanged: boolean, healed: number }}
 */
export function applyCastSelfEffects(player, skill, now) {
  return applySelfEffects(skill, player, now);
}

/**
 * Authorize one follow-up strike and recompute its damage from server-owned
 * stats. Shared by monster (`enemy_hit`) and player (`player_hit`) hits: both
 * must follow an accepted cast or swing, and neither trusts a client number.
 *
 * Mutates the accepted cast's hit budget (`attacker.lastCast`) or consumes the
 * plain swing (`attacker.lastSwing`), exactly like the live server path.
 *
 * @param {Object} attacker server player object
 * @param {Object} attackerStats derived stats for this hit
 * @param {number} defenderDefense target's defense
 * @param {*} requestedSkill raw `payload.skill`
 * @param {number} now
 * @param {Function|number} [random]
 * @returns {{ skill: Object|null, attackerStats: Object, damage: number }|null}
 *   null when no accepted cast/swing authorizes the hit
 */
export function resolveSkillHit(
  attacker,
  attackerStats,
  defenderDefense,
  requestedSkill,
  now,
  random = Math.random
) {
  const skill = requestedSkill ? skillById(requestedSkill) : null;

  if (skill) {
    if (skill.weapon !== attacker.weaponType) return null;
    if (!skillUsable(skill, attacker.level, attacker.learnedSkills)) return null;
    if (!consumeCastHit(attacker.lastCast, skill, now)) return null;
    return {
      skill,
      attackerStats,
      damage: computeSkillDamage(skill, attackerStats, { defense: defenderDefense }, random).damage
    };
  }

  const swing = attacker.lastSwing;
  if (!swing || swing.used || now - swing.at > HIT_WINDOW_MS) return null;
  swing.used = true;
  return {
    skill: null,
    attackerStats,
    damage: computeDamage(attackerStats, { defense: defenderDefense }, random).damage
  };
}

/**
 * Roll one splash strike: a fixed fraction of the skill's multiplier, using the
 * same RNG as a direct hit.
 *
 * @param {Object} skill
 * @param {Object} attackerStats
 * @param {number} defenderDefense
 * @param {Function|number} [random]
 * @returns {number}
 */
export function splashDamage(skill, attackerStats, defenderDefense, random = Math.random) {
  return computeSkillDamage(
    skill,
    attackerStats,
    { defense: defenderDefense },
    random,
    splashMultiplier(skill)
  ).damage;
}
