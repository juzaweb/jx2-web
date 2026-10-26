/**
 * Server-owned monster control effects: stun and slow.
 *
 * A skill's `effects` list is gameplay data, so it must be applied where the
 * world is decided — on the server. The client only renders the resulting
 * positions; it must not decide that a monster is slowed or stunned.
 *
 * Kept Phaser-free so the server imports exactly the same rules the catalog
 * describes (see `src/game/skills.js`).
 */

/** A slow can never freeze a monster or reverse its speed. */
export const MIN_SLOW_SCALE = 0.15;
/** Upper bound for a slow, so a single effect can never stop movement outright. */
export const MAX_SLOW_PCT = 0.85;
/** Longest control duration a single skill effect may apply. */
export const MAX_CONTROL_MS = 60000;

/**
 * Normalize a duration in ms to a finite, non-negative, capped value.
 * @param {*} value
 * @returns {number}
 */
const toDuration = (value) => {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(MAX_CONTROL_MS, duration);
};

/**
 * Normalize a slow percentage into [0, MAX_SLOW_PCT].
 * @param {*} value
 * @returns {number}
 */
const toSlowPct = (value) => {
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(MAX_SLOW_PCT, pct);
};

/**
 * Roll an effect's optional proc chance. A missing chance means the effect always
 * applies; a chance at or above 1 also always applies; a non-numeric, zero or
 * negative chance never applies, so corrupt catalog data cannot grant a free
 * unconditional stun.
 * @param {*} chance
 * @param {Function} rng
 * @returns {boolean}
 */
const rollChance = (chance, rng) => {
  if (chance === undefined || chance === null) return true;
  const value = Number(chance);
  if (!Number.isFinite(value) || value <= 0) return false;
  if (value >= 1) return true;
  const random = typeof rng === "function" ? rng : Math.random;
  return random() < value;
};

/**
 * Apply a skill's control effects to a monster. Effects never shorten one that
 * is already active: a second cast can only extend the stun or deepen the slow.
 *
 * An effect may declare `chance` (0..1) so a multi-hit skill rolls for it on
 * every landed strike (e.g. La Hán Quyền's stun). Effects without a chance
 * always apply.
 *
 * @param {Object} enemy authoritative enemy state (mutated in place)
 * @param {{effects?: Array<{kind:string, duration?:number, pct?:number, chance?:number}>}} skill
 * @param {number} [now=Date.now()]
 * @param {Function} [rng=Math.random] server RNG, so the chance roll is authoritative
 * @returns {Object} the same enemy, for chaining
 */
export function applyEnemyControlEffects(enemy, skill, now = Date.now(), rng = Math.random) {
  if (!enemy || !skill || !Array.isArray(skill.effects)) return enemy;

  for (const effect of skill.effects) {
    if (!effect) continue;
    const duration = toDuration(effect.duration);
    if (duration === 0) continue;

    if (effect.kind === "stun") {
      if (!rollChance(effect.chance, rng)) continue;
      enemy.stunUntil = Math.max(enemy.stunUntil || 0, now + duration);
    } else if (effect.kind === "slow") {
      const pct = toSlowPct(effect.pct);
      // A zero or missing percentage is not a slow at all: applying a timer for
      // it would report a debuff that does nothing.
      if (pct <= 0) continue;
      if (!rollChance(effect.chance, rng)) continue;
      enemy.slowUntil = Math.max(enemy.slowUntil || 0, now + duration);
      enemy.slowPct = Math.max(enemy.slowPct || 0, pct);
    }
  }

  return enemy;
}

/**
 * Movement scale for one monster: 0 while stunned, reduced while slowed, 1
 * otherwise. Multiply the AI step's delta by this value.
 * @param {Object} enemy
 * @param {number} [now=Date.now()]
 * @returns {number} 0..1
 */
export function enemyMoveScale(enemy, now = Date.now()) {
  if (!enemy) return 1;
  if (now < (enemy.stunUntil || 0)) return 0;
  if (now < (enemy.slowUntil || 0)) {
    // Clamp both ends: corrupt state can neither freeze nor speed up a monster.
    return Math.min(1, Math.max(MIN_SLOW_SCALE, 1 - (enemy.slowPct || 0)));
  }
  return 1;
}

/**
 * Whether a monster is currently stunned (cannot move or bite).
 * @param {Object} enemy
 * @param {number} [now=Date.now()]
 * @returns {boolean}
 */
export function isEnemyStunned(enemy, now = Date.now()) {
  return Boolean(enemy) && now < (enemy.stunUntil || 0);
}

/**
 * Clear every control effect. Used on respawn so a corpse does not return frozen.
 * @param {Object} enemy
 * @returns {Object} the same enemy, for chaining
 */
export function clearEnemyControlEffects(enemy) {
  if (!enemy) return enemy;
  enemy.stunUntil = 0;
  enemy.slowUntil = 0;
  enemy.slowPct = 0;
  return enemy;
}
