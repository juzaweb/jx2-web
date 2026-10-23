/**
 * Pure helpers for click-to-move travel. Kept free of Phaser so the
 * overshoot/catch-up rules can be unit tested.
 */

/** Longest frame delta (ms) a single movement tick may use. */
export const MAX_MOVE_DELTA_MS = 50;

/** Smallest snap radius (px) used when a leg is almost finished. */
export const MIN_SNAP_DISTANCE = 8;

/**
 * Distance (px) travelled this frame. Capping the delta stops a long frame
 * (tab switch, GC pause) from teleporting the player past the target.
 * @param {number} speed px per second
 * @param {number} deltaMs frame delta in milliseconds
 * @returns {number}
 */
export function travelStep(speed, deltaMs) {
  const delta = Number.isFinite(deltaMs) ? Math.min(Math.max(deltaMs, 0), MAX_MOVE_DELTA_MS) : 0;
  return speed * (delta / 1000);
}

/**
 * Whether a leg is close enough to finish and snap to its target. The radius
 * must cover one frame of travel: with a fixed 8px radius a low frame rate
 * overshoots the target every frame and the player oscillates back and forth.
 * @param {number} distance remaining distance in px
 * @param {number} step distance travelled per frame in px
 * @returns {boolean}
 */
export function shouldSnap(distance, step) {
  return Math.abs(distance) <= Math.max(MIN_SNAP_DISTANCE, step);
}

/**
 * Whether a leg's remaining signed distance flipped direction between frames.
 * Means the body crossed its target, so it must be snapped instead of pushed
 * back (which would oscillate).
 * @param {number} previous previous signed remaining distance
 * @param {number} current current signed remaining distance
 * @returns {boolean}
 */
export function crossedTarget(previous, current) {
  return (previous > 0 && current < 0) || (previous < 0 && current > 0);
}
