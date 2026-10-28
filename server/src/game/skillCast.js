/**
 * Pure server-side skill action rules: casting, book study, levelling and the
 * authorization of a follow-up hit.
 *
 * Extracted from the WebSocket server so cast validation, self-effect
 * application, study/upgrade gates and damage authorization can be unit-tested
 * without a socket, a live world, or a database. Every function here takes plain
 * objects and mutates only the state it is handed (the cast's hit budget, the
 * player's buffs/HP), never transport or storage.
 *
 * The client shares the same catalog and maths through `src/game/skills.js`, so
 * both sides cannot drift apart.
 */

import {
  applySelfEffects,
  characterLevelForSkillLevel,
  isInsideCastArea,
  skillAtLevel,
  skillById,
  skillFundsShortfall,
  skillLearnable,
  skillLearned,
  skillLevelOf,
  skillLockReason,
  skillUpgradeCost,
  skillUsable
} from "../../../src/game/skills.js";
import { HIT_WINDOW_MS, consumeCastHit, splashMultiplier } from "../../../src/game/combatRules.js";
import { NORMAL_ATTACK_MULT } from "../../../src/game/combatConfig.js";
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
 * Magnitudes follow the caster's level in that skill. Broadcasting and
 * persistence stay with the caller.
 *
 * @param {{ hp: number, maxHp: number, buffs?: Object[], skillLevels?: Record<string, number> }} player
 * @param {Object} skill
 * @param {number} now
 * @returns {{ statsChanged: boolean, healed: number }}
 */
export function applyCastSelfEffects(player, skill, now) {
  const leveled = skillAtLevel(skill, skillLevelOf(player?.skillLevels, skill?.id));
  return applySelfEffects(leveled, player, now);
}

/**
 * Why a skill cannot be levelled up right now, or null when it can.
 *
 * A skill must already be learned (starter skills count), below the maximum
 * rank, the character must be high enough level for the rank being bought, and
 * the ledger must hold the silver and EXP it costs. The server calls this before
 * debiting anything.
 *
 * @param {Object|null|undefined} skill resolved catalog entry
 * @param {{ level?: number, learnedSkills?: string[], skillLevels?: Record<string, number>,
 *   progress?: { coins?: number, exp?: number }|null }} player
 * @returns {{ reason: "not_usable"|"not_learned"|"max_level"|"level"|"coins"|"exp",
 *   level?: number, skillLevel?: number, current?: number,
 *   coins?: number, exp?: number,
 *   required?: { coins: number, exp: number } }|null}
 */
export function upgradeRejection(skill, player) {
  if (!skill) return { reason: "not_usable" };
  if (!skillLearned(skill, player?.learnedSkills)) return { reason: "not_learned" };

  const current = skillLevelOf(player?.skillLevels, skill.id);
  const cost = skillUpgradeCost(current);
  if (!cost) return { reason: "max_level", level: current };

  // Every rank demands a higher character level than the previous one, so the
  // hero's level gates the rank independently of what the ledger can pay.
  const characterLevel = Math.floor(Number(player?.level) || 1);
  const requiredLevel = characterLevelForSkillLevel(skill, current + 1);
  if (characterLevel < requiredLevel) {
    return {
      reason: "level",
      level: requiredLevel,
      skillLevel: current + 1,
      current: characterLevel
    };
  }

  const funds = skillFundsShortfall(cost, player?.progress);
  if (funds) {
    return {
      reason: funds.reason,
      level: current,
      coins: funds.coins,
      exp: funds.exp,
      required: cost
    };
  }

  return null;
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
    // Damage and any control magnitudes follow the caster's level in the skill;
    // the returned entry is the leveled one so hit application reads the same
    // numbers the damage was rolled from.
    const leveled = skillAtLevel(skill, skillLevelOf(attacker.skillLevels, skill.id));
    return {
      skill: leveled,
      attackerStats,
      damage: computeSkillDamage(leveled, attackerStats, { defense: defenderDefense }, random).damage
    };
  }

  const swing = attacker.lastSwing;
  if (!swing || swing.used || now - swing.at > HIT_WINDOW_MS) return null;
  swing.used = true;
  return {
    skill: null,
    attackerStats,
    // A free swing lands softer than a studied art (see NORMAL_ATTACK_MULT).
    damage: computeDamage(attackerStats, { defense: defenderDefense }, random, {
      skillMult: NORMAL_ATTACK_MULT
    }).damage
  };
}

/**
 * Roll one splash strike: a fixed fraction of the skill's multiplier, using the
 * same RNG as a direct hit and the caster's level in that skill.
 *
 * @param {Object} skill
 * @param {Object} attackerStats
 * @param {number} defenderDefense
 * @param {Function|number} [random]
 * @param {number} [level=1] caster's level in this skill
 * @returns {number}
 */
export function splashDamage(skill, attackerStats, defenderDefense, random = Math.random, level = 1) {
  return computeSkillDamage(
    skillAtLevel(skill, level),
    attackerStats,
    { defense: defenderDefense },
    random,
    splashMultiplier(skill)
  ).damage;
}
