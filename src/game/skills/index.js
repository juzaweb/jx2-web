/**
 * Skill feature module — public API.
 *
 * This barrel is intentionally **pure**: it must not import Phaser, the DOM, or
 * any client-only module, because the Node server imports `src/game/skills.js`
 * (which re-exports this file) to validate casts authoritatively.
 *
 * Client-only pieces live under `./client/` and are imported directly:
 * `skills/client/vfx.js`, `skills/client/tree.js`, `skills/client/castController.js`.
 *
 * Layout:
 * - `catalog/`  authored skill data, one file per weapon kit
 * - `registry`  flat catalog, kits, id/slot lookups
 * - `gating`    learned / learnable / usable / lock-reason rules
 * - `cost`      MP and cooldown, including test-mode overrides
 * - `levels`    skill levels (1..10): scaling, upgrade price and funds checks
 * - `effects`   shared interpretation of self-targeted effects
 * - `area`      cast reach and AoE containment maths
 * - `schema`    authoring helper and catalog validation
 */

export { SKILLS, SKILL_KITS } from "./catalog/index.js";

export {
  SKILL_SLOTS,
  BASIC_ATTACK_ID,
  SKILLS_BY_WEAPON,
  normalizeWeaponType,
  skillsForWeapon,
  skillById,
  skillForSlot,
  skillSlot
} from "./registry.js";

export {
  skillRequires,
  skillUnlocked,
  skillLearned,
  skillStarter,
  skillMissingPrereq,
  skillLearnable,
  skillUsable,
  skillLockReason
} from "./gating.js";


export {
  MAX_SKILL_LEVEL,
  MIN_CHARACTER_LEVEL_TO_LEARN,
  SKILL_LEVEL_BONUS_PER_LEVEL,
  SKILL_LEVELS_PER_CHARACTER_LEVEL,
  SKILL_UPGRADE_COINS_FACTOR,
  SKILL_UPGRADE_EXP_FACTOR,
  normalizeSkillLevel,
  skillLevelOf,
  skillLevelScale,
  skillLevelBonus,
  characterLevelForSkillLevel,
  scaleSkillEffect,
  skillAtLevel,
  skillUpgradeCost,
  skillLearnCost,
  skillFundsShortfall
} from "./levels.js";
export { skillMpCost, skillCooldown, effectiveSkillMpCost, effectiveSkillCooldown } from "./cost.js";

export {
  skillPassiveRegen,
  selfBuffEntries,
  applySelfEffects
} from "./effects.js";

export { skillCastReach, isInsideCastArea } from "./area.js";

export { resolveSkillIcon } from "./presets.js";

export { EFFECT_KINDS, validateSkillCatalog } from "./schema.js";
