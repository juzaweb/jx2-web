/**
 * 8-direction hero sprite mapping.
 *
 * The hero is drawn from an isometric sheet laid out as 8 direction columns
 * (each 45 deg apart) x 6 animation rows (row 0 = idle, rows 1..5 = the walk
 * cycle). Columns are indexed 0..7 counter-clockwise from "facing the camera"
 * (down, down-right, right, ...) and the sheet is read row-major, so
 * frame = row * 8 + column.
 *
 * Facing is derived from the *screen-space* movement direction (the sprite is
 * screen art), which means world velocity goes through the same isometric
 * projection as everything else before being quantised to one of 8 sectors.
 */

import { toIso } from "./isoProjection.js";

export const HERO_DIRECTIONS = 8;
export const HERO_WALK_ROWS = 5;
export const HERO_FRAME_KEY = "hero-8dir";

/**
 * Display size of a 64x96 frame, and the distance from the container origin down
 * to the character's feet (kept in sync with the shadow) so every direction
 * stays planted on the ground.
 */
export const HERO8_DISPLAY = { w: 56, h: 84 };
export const HERO8_FOOT_Y = 41;

/**
 * Screen-space sector (0 = right, then clockwise: down-right, down, ...) to
 * sprite column. Derived from the art itself: column 0 faces the camera (screen
 * down), 2 faces right, 4 faces away (screen up), 6 faces left.
 */
const COLUMN_BY_SECTOR = [2, 1, 0, 7, 6, 5, 4, 3];

/**
 * Pick the sprite column that matches a world-space velocity, taking the
 * isometric projection into account so the hero faces the way it appears to
 * move on screen.
 * @param {number} vx world velocity x
 * @param {number} vy world velocity y
 * @returns {number} column 0..7
 */
export function directionFromVelocity(vx, vy) {
  const screen = toIso(vx, vy);
  const angle = Math.atan2(screen.y, screen.x);
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return COLUMN_BY_SECTOR[sector];
}

/**
 * Row-major frame index within the sheet.
 * @param {number} column 0..7
 * @param {number} row 0..5
 */
export function frameIndex(column, row) {
  return row * HERO_DIRECTIONS + column;
}

/** Idle frame (row 0) for a direction. */
export function idleFrame(column) {
  return frameIndex(column, 0);
}

/** The 5 walk-cycle frames for a direction, in playback order. */
export function walkFrames(column) {
  const frames = [];
  for (let row = 1; row <= HERO_WALK_ROWS; row++) {
    frames.push(frameIndex(column, row));
  }
  return frames;
}

/** Animation key for a direction's walk cycle. */
export function walkAnimKey(column) {
  return `hero-walk-${column}`;
}

/**
 * Register the 8 walk animations on a scene once. Safe to call repeatedly.
 * @param {Phaser.Scene} scene
 * @returns {boolean} true when the sheet is loaded and animations are ready
 */
export function ensureHeroWalkAnims(scene) {
  if (!scene?.textures?.exists?.(HERO_FRAME_KEY)) return false;
  for (let column = 0; column < HERO_DIRECTIONS; column++) {
    const key = walkAnimKey(column);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: walkFrames(column).map((frame) => ({ key: HERO_FRAME_KEY, frame })),
      frameRate: 12,
      repeat: -1
    });
  }
  return true;
}
