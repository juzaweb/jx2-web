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

import { toIso } from "./isoProjection.js";

export const HERO_DIRECTIONS = 8;

/**
 * Screen-space sector (0 = right, then clockwise: down-right, down, ...) mapped
 * to the rig direction index. Both are 8-way and 45 deg apart.
 */
const DIRECTION_BY_SECTOR = [2, 1, 0, 7, 6, 5, 4, 3];

/**
 * Pick the facing direction that matches a world-space velocity, taking the
 * isometric projection into account so the hero faces the way it appears to
 * move on screen.
 * @param {number} vx world velocity x
 * @param {number} vy world velocity y
 * @returns {number} direction 0..7
 */
export function directionFromVelocity(vx, vy) {
  const screen = toIso(vx, vy);
  const angle = Math.atan2(screen.y, screen.x);
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return DIRECTION_BY_SECTOR[sector];
}
