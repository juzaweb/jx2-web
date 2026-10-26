/**
 * Combat range and cadence rules shared by the client and the Node server.
 *
 * Kept free of Phaser/DOM so the server can validate a hit or a movement step
 * with the same numbers the client used to produce it.
 */

import { ATTACK_INTERVAL_MS } from "./combatConfig.js";
import { BASE_WALK_SPEED, WORLD_POSITION_SCALE, WORLD_SPEED_SCALE } from "./worldConfig.js";

/** World-space reach (px) of a plain sword swing against a monster. */
export const MELEE_REACH = 280;

/**
 * How long after a cast or swing the server still accepts the matching hit.
 * Keeps a delayed packet valid without letting a client mint hits forever from
 * one cast.
 */
export const HIT_WINDOW_MS = 2000;

/** Upper bound of targets one skill cast may hit (an AoE may legitimately hit a few). */
export const MAX_HITS_PER_CAST = 8;

/** Extra radius (px) allowed around a skill's own area when validating a hit. */
export const HIT_RADIUS_SLACK = 40;

/** Upper bound of hits a single channelled cast may land (guards a forged client). */
export const MAX_CHANNEL_HITS = 40;

/** Extra time (ms) after a channel's nominal duration to accept a laggy final hit. */
export const CHANNEL_HIT_SLACK_MS = 400;

/** Tolerance (ms) under a channel interval when pacing its hits server-side. */
export const CHANNEL_HIT_GAP_SLACK_MS = 50;

/**
 * Duration (ms) of a channelled skill, or 0 when it is a one-shot cast.
 * @param {Object} skill
 * @returns {number}
 */
export function channelDurationMs(skill) {
  const duration = Number(skill?.channel?.durationMs);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

/**
 * Milliseconds between two strikes of a channelled skill, or 0 when it is not channelled.
 * @param {Object} skill
 * @returns {number}
 */
export function channelIntervalMs(skill) {
  const interval = Number(skill?.channel?.intervalMs);
  return Number.isFinite(interval) && interval > 0 ? interval : 0;
}

/**
 * Whether a skill holds the caster in a repeating multi-hit channel.
 * @param {Object} skill
 * @returns {boolean}
 */
export function isChannelSkill(skill) {
  return channelDurationMs(skill) > 0 && channelIntervalMs(skill) > 0;
}

/**
 * Number of strikes a channelled skill lands over its duration.
 * @param {Object} skill
 * @returns {number} 0 for a one-shot skill
 */
export function channelHitCount(skill) {
  if (!isChannelSkill(skill)) return 0;
  return Math.max(1, Math.ceil(channelDurationMs(skill) / channelIntervalMs(skill)));
}

/**
 * How long after a cast its hits are still accepted. A channel needs the whole
 * flurry plus a little slack; one-shot casts keep the tuned two-second window.
 * @param {Object} skill
 * @returns {number}
 */
export function castHitWindowMs(skill) {
  return isChannelSkill(skill) ? channelDurationMs(skill) + CHANNEL_HIT_SLACK_MS : HIT_WINDOW_MS;
}

/**
 * Cap on hits one cast may land. A channel derives it from its own tick count so
 * a forged client cannot mint strikes beyond the flurry it paid for.
 * @param {Object} skill
 * @returns {number}
 */
export function maxHitsPerCast(skill) {
  if (!isChannelSkill(skill)) return MAX_HITS_PER_CAST;
  return Math.min(MAX_CHANNEL_HITS, channelHitCount(skill) + 2);
}

/**
 * Consume one authorized follow-up hit from an accepted cast.
 *
 * Returns false when the hit does not belong to that cast, arrives outside the
 * cast's hit window, exceeds the cast's hit cap, or comes faster than a channel
 * tick is allowed to (so a forged client cannot burst the whole flurry at once).
 * On success the cast's hit counter and last-hit timestamp are updated.
 *
 * @param {{ skillId: string, at: number, hits: number, lastHitAt?: number }|null} cast
 *   server-side `lastCast`
 * @param {Object} skill the accepted skill, from the catalog
 * @param {number} now
 * @returns {boolean}
 */
export function consumeCastHit(cast, skill, now) {
  if (!cast || cast.skillId !== skill?.id) return false;
  if (now - cast.at > castHitWindowMs(skill)) return false;
  if (cast.hits >= maxHitsPerCast(skill)) return false;

  // Pace channel ticks server-side; the slack absorbs normal network jitter.
  const minGapMs = Math.max(0, channelIntervalMs(skill) - CHANNEL_HIT_GAP_SLACK_MS);
  if (minGapMs > 0 && Number.isFinite(cast.lastHitAt) && now - cast.lastHitAt < minGapMs) {
    return false;
  }

  cast.hits += 1;
  cast.lastHitAt = now;
  return true;
}

/** Hard cap on extra monsters one splash strike may hit. */
export const MAX_SPLASH_TARGETS = 8;

/**
 * World radius (px) around the primary target that a splash strike covers.
 * @param {Object} skill
 * @returns {number} 0 when the skill does not splash
 */
export function splashRadius(skill) {
  const radius = Number(skill?.splash?.radius);
  return Number.isFinite(radius) && radius > 0 ? radius : 0;
}

/**
 * Fraction of the primary strike's damage dealt to each splash victim.
 * @param {Object} skill
 * @returns {number} 0..1, or 0 when the skill does not splash
 */
export function splashMultiplier(skill) {
  const mult = Number(skill?.splash?.mult);
  return Number.isFinite(mult) && mult > 0 ? Math.min(1, mult) : 0;
}

/**
 * Most splash victims one strike may damage.
 * @param {Object} skill
 * @returns {number}
 */
export function splashMaxTargets(skill) {
  const max = Number(skill?.splash?.maxTargets);
  if (!Number.isFinite(max) || max <= 0) return MAX_SPLASH_TARGETS;
  return Math.min(MAX_SPLASH_TARGETS, Math.floor(max));
}

/**
 * Whether a skill's strikes splash onto nearby monsters.
 * @param {Object} skill
 * @returns {boolean}
 */
export function hasSplash(skill) {
  return splashRadius(skill) > 0 && splashMultiplier(skill) > 0;
}

/**
 * Monsters caught by a splash strike centred on `primary`, nearest first.
 * Excludes the primary itself and dead monsters, and caps the list so one
 * strike cannot damage an entire map.
 *
 * @param {Object} primary monster the strike landed on
 * @param {Object[]} enemies every monster on the same map
 * @param {Object} skill
 * @returns {Object[]} up to `splashMaxTargets(skill)` monsters
 */
export function splashVictims(primary, enemies, skill) {
  const radius = splashRadius(skill);
  if (!primary || radius <= 0 || !Array.isArray(enemies)) return [];

  return enemies
    .filter((enemy) => enemy && enemy !== primary && !enemy.isDead)
    .map((enemy) => ({
      enemy,
      distance: Math.hypot(enemy.x - primary.x, enemy.y - primary.y)
    }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, splashMaxTargets(skill))
    .map(({ enemy }) => enemy);
}

/** Position tolerance multiplier on top of the walk speed. */
export const MOVE_SPEED_TOLERANCE = 1.75;

/** Absolute position slack (px) so a lag spike cannot trigger a false snap-back. */
export const MOVE_SLACK_PX = 120;

/**
 * Milliseconds between two normal attacks for an attack-speed multiplier.
 * @param {number} [attackSpeed] multiplier (1 = base cadence)
 * @returns {number}
 */
export function attackIntervalFor(attackSpeed) {
  const speed = Number(attackSpeed);
  return ATTACK_INTERVAL_MS / (Number.isFinite(speed) && speed > 0 ? speed : 1);
}

/**
 * World-space walk speed (px per second) for a movement multiplier.
 * @param {number} [speedMultiplier] 1 = base walk speed, 1.2 = +20%
 * @returns {number}
 */
export function walkSpeedFor(speedMultiplier = 1) {
  const multiplier = Number(speedMultiplier);
  const safe = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return BASE_WALK_SPEED * WORLD_POSITION_SCALE * WORLD_SPEED_SCALE * safe;
}

/**
 * Farthest distance a player may travel in `deltaMs` without teleporting.
 * @param {number} deltaMs elapsed time since the previous accepted move
 * @param {number} [speedMultiplier] 1 = base walk speed
 * @param {{ tolerance?: number, slack?: number }} [options]
 * @returns {number} allowed distance in world pixels
 */
export function maxTravelDistance(deltaMs, speedMultiplier = 1, options = {}) {
  const delta = Number(deltaMs);
  const elapsed = Number.isFinite(delta) && delta > 0 ? delta : 0;
  const tolerance =
    Number.isFinite(options.tolerance) && options.tolerance > 0
      ? options.tolerance
      : MOVE_SPEED_TOLERANCE;
  const slack =
    Number.isFinite(options.slack) && options.slack >= 0 ? options.slack : MOVE_SLACK_PX;
  return (walkSpeedFor(speedMultiplier) * elapsed * tolerance) / 1000 + slack;
}
