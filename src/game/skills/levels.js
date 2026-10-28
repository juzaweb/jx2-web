/**
 * Skill levels: the 1..10 progression of a learned skill.
 *
 * A skill is studied at level 1 and can be raised to {@link MAX_SKILL_LEVEL}; each
 * level strengthens the art (damage multiplier and effect magnitudes), demands a
 * higher character level and costs silver plus EXP from the current ledger. The
 * price grows with the square of the level, so the last ranks are committed
 * investment rather than a cheap step.
 *
 * Kept pure and Phaser/DOM-free: the client renders these numbers and the server
 * bills and authorizes them through the very same functions, so the two sides can
 * never disagree about what a level is worth.
 *
 * Prices are quoted in bạc but the ledger is held in đồng, so every cost carries
 * both the quoted bạc figure and its đồng equivalent.
 */
import { toLedgerDong } from "../currency.js";

/** Highest level a skill can reach. */
export const MAX_SKILL_LEVEL = 10;

/** Damage/effect gain per level above the first (+10% each, +90% at level 10). */
export const SKILL_LEVEL_BONUS_PER_LEVEL = 0.1;

/**
 * Minimum character level before any book can be studied. A hero below this
 * level can only use the starter art; every book waits for level 10.
 */
export const MIN_CHARACTER_LEVEL_TO_LEARN = 10;

/**
 * Character levels each extra skill rank demands. Rank 1 costs nothing beyond
 * the entry requirement, so rank `n` needs
 * `max(unlockLevel, MIN_CHARACTER_LEVEL_TO_LEARN) + 4 * (n - 1)`.
 */
export const SKILL_LEVELS_PER_CHARACTER_LEVEL = 4;

/** Bạc quoted for a target level: `factor * targetLevel²` (20/80/…/2.000). */
export const SKILL_UPGRADE_COINS_FACTOR = 20;

/** EXP charged for a target level: `factor * targetLevel²` (30/120/…/3.000). */
export const SKILL_UPGRADE_EXP_FACTOR = 30;

const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : null;
};

/**
 * Coerce a caller-supplied level into an integer inside 1..MAX_SKILL_LEVEL.
 * Anything unreadable falls back to level 1, so a corrupt save can never grant a
 * skill a level it did not pay for.
 * @param {*} level
 * @returns {number}
 */
export function normalizeSkillLevel(level) {
  const n = toInt(level);
  if (n === null || n < 1) return 1;
  return Math.min(MAX_SKILL_LEVEL, n);
}

/**
 * Level of one skill inside a `skillId -> level` map, defaulting to 1 (the level
 * every learned skill starts at).
 * @param {Record<string, number>|null|undefined} levels
 * @param {string} skillId
 * @returns {number}
 */
export function skillLevelOf(levels, skillId) {
  if (!levels || typeof levels !== "object" || typeof skillId !== "string") return 1;
  return normalizeSkillLevel(levels[skillId] ?? 1);
}

/**
 * Multiplier applied to a skill's damage/effect numbers at a given level.
 * Level 1 is exactly `1`; every extra level adds {@link SKILL_LEVEL_BONUS_PER_LEVEL}.
 * @param {number} level
 * @returns {number}
 */
export function skillLevelScale(level) {
  return 1 + SKILL_LEVEL_BONUS_PER_LEVEL * (normalizeSkillLevel(level) - 1);
}

/**
 * Fractional bonus a level grants (0 at level 1, 0.9 at level 10). Handy for UI
 * labels and for callers that already multiply by 1.
 * @param {number} level
 * @returns {number}
 */
export function skillLevelBonus(level) {
  return skillLevelScale(level) - 1;
}

/**
 * Scale one declared effect by a level scale. Only magnitudes gain: control
 * effects (`stun`, `slow`) keep their authored duration and percentage so a
 * level-up can never turn a short stun into a lock-out.
 * @param {Object} effect
 * @param {number} scale
 * @returns {Object} the original effect when nothing changes
 */
export function scaleSkillEffect(effect, scale) {
  if (!effect || typeof effect !== "object") return effect;
  const factor = Number(scale);
  if (!Number.isFinite(factor) || factor === 1) return effect;

  if (effect.kind === "buff") {
    const amount = Number(effect.amount) || 0;
    return { ...effect, amount: amount * factor };
  }
  if (effect.kind === "heal") {
    const amount = Number(effect.amount) || 0;
    const pctMaxHp = Number(effect.pctMaxHp) || 0;
    return {
      ...effect,
      amount: amount * factor,
      // A heal may never restore more than the whole pool it scales against.
      pctMaxHp: pctMaxHp > 0 ? Math.min(1, pctMaxHp * factor) : pctMaxHp
    };
  }
  if (effect.kind === "regen") {
    const hpPerSecond = Number(effect.hpPerSecond) || 0;
    return { ...effect, hpPerSecond: hpPerSecond * factor };
  }
  return effect;
}

/**
 * A catalog entry as it behaves at one level: the same skill, with `mult` and the
 * magnitudes of its effects scaled up. Everything else (id, weapon, gating,
 * splash shape, VFX) is preserved, so the result can be fed to every reader that
 * accepts a skill.
 *
 * Level 1 returns the entry unchanged, keeping the hot path allocation-free.
 * @param {Object|null|undefined} skill
 * @param {number} [level=1]
 * @returns {Object|null|undefined}
 */
export function skillAtLevel(skill, level = 1) {
  if (!skill || typeof skill !== "object") return skill;
  const scale = skillLevelScale(level);
  if (scale === 1) return skill;

  const scaled = { ...skill };
  const mult = Number(skill.mult);
  if (Number.isFinite(mult) && mult > 0) scaled.mult = mult * scale;

  if (Array.isArray(skill.effects) && skill.effects.length > 0) {
    scaled.effects = skill.effects.map((effect) => scaleSkillEffect(effect, scale));
  }
  return scaled;
}

/**
 * Minimum character level needed to hold a skill at `skillLevel`.
 *
 * Rank 1 is the gate for studying the book: the catalog's own `unlockLevel`, but
 * never below {@link MIN_CHARACTER_LEVEL_TO_LEARN} (10). Every further rank adds
 * {@link SKILL_LEVELS_PER_CHARACTER_LEVEL} character levels, so a rank-10 art
 * needs a hero at least 36 levels past the book's requirement.
 *
 * @param {{ unlockLevel?: number }|number} skill skill entry, or its unlockLevel
 * @param {number} skillLevel
 * @returns {number}
 */
export function characterLevelForSkillLevel(skill, skillLevel) {
  const unlock = Number(typeof skill === "object" ? skill?.unlockLevel : skill);
  const catalogLevel = Number.isFinite(unlock) && unlock > 0 ? Math.floor(unlock) : 1;
  const base = Math.max(MIN_CHARACTER_LEVEL_TO_LEARN, catalogLevel);
  return base + SKILL_LEVELS_PER_CHARACTER_LEVEL * (normalizeSkillLevel(skillLevel) - 1);
}

/**
 * Price of the next rank, or null when the art is already at
 * {@link MAX_SKILL_LEVEL}.
 *
 * The price grows with the square of the level being bought, so the high ranks
 * cost a multiple of the first ones: 80/120 bạc/EXP for rank 2, 2.000/3.000 for
 * rank 10.
 *
 * Two money fields are returned because the price is *quoted* in bạc while the
 * ledger is held in đồng: `coinsBac` is what the panel shows, `coinsDong` is
 * what the server debits and what {@link skillFundsShortfall} checks.
 * @param {number} currentLevel
 * @returns {{ coinsBac: number, coinsDong: number, exp: number }|null}
 */
export function skillUpgradeCost(currentLevel) {
  const level = normalizeSkillLevel(currentLevel);
  if (level >= MAX_SKILL_LEVEL) return null;
  const target = level + 1;
  const coinsBac = SKILL_UPGRADE_COINS_FACTOR * target * target;
  return {
    coinsBac,
    coinsDong: toLedgerDong(coinsBac),
    exp: SKILL_UPGRADE_EXP_FACTOR * target * target
  };
}

/**
 * Price of studying a book the first time (buying rank 1, the cheapest rank in
 * the curve).
 * @returns {{ coinsBac: number, coinsDong: number, exp: number }}
 */
export function skillLearnCost() {
  return {
    coinsBac: SKILL_UPGRADE_COINS_FACTOR,
    coinsDong: toLedgerDong(SKILL_UPGRADE_COINS_FACTOR),
    exp: SKILL_UPGRADE_EXP_FACTOR
  };
}

/**
 * Why the character cannot pay `cost`, or null when it can. Checked server-side
 * before a book is consumed, so a refused study never destroys the book.
 *
 * The ledger holds đồng, so the comparison uses `coinsDong`. A cost missing its
 * `coinsDong` or `exp` is treated as unaffordable rather than free: failing
 * closed can only refuse an upgrade, never grant one for nothing.
 * @param {{coinsDong:number, exp:number}|null} cost
 * @param {{coins?:number, exp?:number}|null|undefined} progress character ledger
 * @returns {{ reason: "coins"|"exp", coins: number, exp: number,
 *   required: {coinsDong:number, exp:number} }|null}
 */
export function skillFundsShortfall(cost, progress) {
  if (!cost) return null;
  const coins = Math.max(0, Number(progress?.coins) || 0);
  const exp = Math.max(0, Number(progress?.exp) || 0);
  const requiredCoins = Number.isFinite(cost.coinsDong) ? cost.coinsDong : Infinity;
  const requiredExp = Number.isFinite(cost.exp) ? cost.exp : Infinity;
  if (coins < requiredCoins || exp < requiredExp) {
    return {
      reason: coins < requiredCoins ? "coins" : "exp",
      coins,
      exp,
      required: cost
    };
  }
  return null;
}
