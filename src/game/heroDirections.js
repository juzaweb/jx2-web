/**
 * 8-direction hero facing.
 *
 * The hero can face 8 directions (45 deg apart). Facing is derived from the
 * *screen-space* movement direction (the character is drawn in screen space), so
 * world velocity goes through the same isometric projection as everything else
 * before being quantised to one of 8 sectors.
 *
 * Direction index convention (shared by the vector rig in heroRig.js):
 *   0 = facing the camera (down), then counter-clockwise:
 *   1 = down-right, 2 = right, 3 = up-right, 4 = away (up),
 *   5 = up-left, 6 = left, 7 = down-left.
 */

export const HERO_DIRECTIONS = 8;

/**
 * Screen-space sector (0 = right, then clockwise: down-right, down, ...) mapped
 * to the rig direction index. Both are 8-way and 45 deg apart.
 */
const DIRECTION_BY_SECTOR = [2, 1, 0, 7, 6, 5, 4, 3];

/**
 * Pick the facing direction from a world-space velocity. The market uses
 * four-way movement (up / down / left / right); when both axes are non-zero the
 * dominant axis wins so the rig never shows a diagonal pose.
 * @param {number} vx world velocity x
 * @param {number} vy world velocity y
 * @returns {number} direction 0 (down), 2 (right), 4 (up) or 6 (left)
 */
export function directionFromVelocity(vx, vy) {
  if (Math.abs(vx) >= Math.abs(vy)) return vx >= 0 ? 2 : 6;
  return vy >= 0 ? 0 : 4;
}
