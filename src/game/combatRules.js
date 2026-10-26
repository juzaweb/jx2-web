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
