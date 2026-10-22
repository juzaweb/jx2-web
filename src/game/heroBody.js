/**
 * Baked hero body sheets.
 *
 * Four rows (front, left, right, back) x four walk frames. The runtime frames
 * are produced by scripts/build_hero_body.py, which re-anchors every frame to a
 * shared ground line and scaling so the body lines up with the old rig's feet.
 */

import { HERO_DIRECTIONS } from "./heroDirections.js";
import { normalizeGender } from "./gender.js";

/** Bump this whenever the sheets are regenerated so browsers drop cached art. */
const BODY_ASSET_VERSION = "2";

export const HERO_BODY_TEXTURES = {
  male: { key: "hero-body-male", url: `/hero-body-male.png?v=${BODY_ASSET_VERSION}` },
  female: { key: "hero-body-female", url: `/hero-body-female.png?v=${BODY_ASSET_VERSION}` }
};

/**
 * Frame geometry is written by scripts/build_hero_body.py; keep the two copies
 * in sync. Source content is 140px tall; rendered at ~92.5 rig units.
 */
const CONTENT_HEIGHT_PX = 140;
const BODY_HEIGHT_UNITS = 92.5;
const BODY_SCALE = BODY_HEIGHT_UNITS / CONTENT_HEIGHT_PX;
const FRAME_BOTTOM_MARGIN_PX = 0;

export const HERO_BODY = {
  frameWidth: 128,
  frameHeight: 160,
  columns: 4,
  rows: 4,
  scale: BODY_SCALE,
  /** Rig-space Y of the sheet bottom so the content baseline sits at the feet. */
  footOffsetY: FRAME_BOTTOM_MARGIN_PX * BODY_SCALE
};

/**
 * Sheet row for each of the eight facing directions.
 *
 * Row 1 (the source art's "left" row) is inconsistent: its first two walk
 * frames are drawn facing right and its last two facing left, so playing it
 * spins the hero on the spot. Row 2 is a complete, consistent right-facing
 * walk cycle, so every side-facing direction uses it and left-facing
 * directions mirror the sprite (see bodyMirrorsForDirection).
 */
const ROW_BY_DIRECTION = [0, 2, 2, 2, 3, 2, 2, 2];

/**
 * The source art has no distinct left profile: the "left" row is drawn facing
 * right, same as the right row. Left-facing directions therefore draw the sheet
 * mirrored so the hero looks the way it walks.
 */
const MIRRORED_DIRECTIONS = [5, 6, 7];

/**
 * @param {"male"|"female"} gender
 * @returns {string} Phaser texture key
 */
export function bodyTextureFor(gender) {
  return HERO_BODY_TEXTURES[normalizeGender(gender)].key;
}

/**
 * @param {number} direction 0..7 (see heroDirections.js)
 * @returns {number} sheet row
 */
export function bodyRowForDirection(direction = 0) {
  const value = Number.isFinite(direction) ? direction : 0;
  const d = ((Math.round(value) % HERO_DIRECTIONS) + HERO_DIRECTIONS) % HERO_DIRECTIONS;
  return ROW_BY_DIRECTION[d];
}

/**
 * Whether the body sheet must be flipped horizontally for this direction.
 * @param {number} direction 0..7 (see heroDirections.js)
 * @returns {boolean}
 */
export function bodyMirrorsForDirection(direction = 0) {
  const value = Number.isFinite(direction) ? direction : 0;
  const d = ((Math.round(value) % HERO_DIRECTIONS) + HERO_DIRECTIONS) % HERO_DIRECTIONS;
  return MIRRORED_DIRECTIONS.includes(d);
}

/**
 * Pick the walk frame for a direction and gait phase. Frame 0 is the neutral
 * pose, so phase 0 returns the idle frame.
 * @param {number} direction
 * @param {number} [phase] radians
 * @returns {number} row-major frame index within the body sheet
 */
export function bodyFrameForDirection(direction, phase = 0) {
  const row = bodyRowForDirection(direction);
  const gait = Number.isFinite(phase) ? phase : 0;
  const turn = ((gait % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const column = Math.floor((turn / (Math.PI * 2)) * HERO_BODY.columns) % HERO_BODY.columns;
  return row * HERO_BODY.columns + column;
}
