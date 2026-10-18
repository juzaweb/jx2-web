/**
 * Pure styling rules for the overhead health bar.
 * Kept free of Phaser so the rules can be unit tested.
 */

/** Fraction of health at/below which the bar turns amber (then red). */
export const HEALTH_WARN_RATIO = 0.5;
export const HEALTH_DANGER_RATIO = 0.25;

export const HEALTH_COLOR_HEALTHY = 0x3ddc6b;
export const HEALTH_COLOR_WARN = 0xffc93c;
export const HEALTH_COLOR_DANGER = 0xe5484d;

/** Overhead bar geometry (px), shared by the local and remote health bars. */
export const HEALTH_BAR_WIDTH = 40;
export const HEALTH_BAR_HEIGHT = 5;

/**
 * Resolve the fill fraction and colour for a health bar.
 *
 * Usable values are clamped into [0, 1]; a missing or non-positive `maxHp`
 * (or a non-finite `hp`) yields an empty bar rather than a divide-by-zero.
 *
 * @param {number} hp
 * @param {number} maxHp
 * @returns {{ratio:number, color:number}}
 */
export function healthBarStyle(hp, maxHp) {
  const safeHp = Number.isFinite(hp) ? hp : 0;
  const safeMax = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : 0;
  const ratio = safeMax > 0 ? Math.min(Math.max(safeHp / safeMax, 0), 1) : 0;

  let color = HEALTH_COLOR_DANGER;
  if (ratio > HEALTH_WARN_RATIO) color = HEALTH_COLOR_HEALTHY;
  else if (ratio > HEALTH_DANGER_RATIO) color = HEALTH_COLOR_WARN;

  return { ratio, color };
}
