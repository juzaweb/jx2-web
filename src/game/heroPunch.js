/**
 * Character normal punch sprite sheet layout definition and helpers.
 *
 * Four direction rows (0: Down/Front, 1: Left, 2: Right, 3: Up/Back) x
 * four attack frames (0: Windup, 1: Punch Extension, 2: Impact Recoil, 3: Return).
 */

import { normalizeGender } from "./gender.js";
import { bodyRowForDirection } from "./heroBody.js";

const PUNCH_ASSET_VERSION = "1";

export const HERO_PUNCH_TEXTURES = {
  male: { key: "hero-punch-male", url: `/hero-punch-male.png?v=${PUNCH_ASSET_VERSION}` },
  female: { key: "hero-punch-female", url: `/hero-punch-female.png?v=${PUNCH_ASSET_VERSION}` }
};

const CONTENT_HEIGHT_PX = 140;
const BODY_HEIGHT_UNITS = 92.5;
const PUNCH_SCALE = BODY_HEIGHT_UNITS / CONTENT_HEIGHT_PX;

export const HERO_PUNCH = {
  frameWidth: 128,
  frameHeight: 160,
  columns: 4,
  rows: 4,
  scale: PUNCH_SCALE,
  footOffsetY: 0
};

/**
 * @param {"male"|"female"} [gender]
 * @returns {string} Phaser texture key for punch sprite sheet
 */
export function punchTextureFor(gender) {
  return HERO_PUNCH_TEXTURES[normalizeGender(gender)].key;
}

/**
 * Pick the punch frame index for a direction (0..7) and frame step (0..3).
 * @param {number} direction
 * @param {number} [frameStep=0] - 0: windup, 1: strike/extend, 2: impact, 3: recovery
 * @returns {number} row-major frame index within the punch sheet
 */
export function punchFrameForDirection(direction, frameStep = 0) {
  const row = bodyRowForDirection(direction);
  const step = Math.max(0, Math.min(HERO_PUNCH.columns - 1, Math.floor(Number.isFinite(frameStep) ? frameStep : 0)));
  return row * HERO_PUNCH.columns + step;
}
