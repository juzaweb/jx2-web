/**
 * Baked hero body sheets.
 *
 * Four rows (front, left, right, back) x four walk frames. The runtime frames
 * are produced by scripts/build_hero_body.py, which re-anchors every frame to a
 * shared ground line and scaling so the body lines up with the old rig's feet,
 * and reorders the source rows so row 1 always faces left and row 2 always
 * faces right.
 */

import { HERO_DIRECTIONS } from "./heroDirections.js";
import { normalizeGender } from "./gender.js";

/** Bump this whenever the sheets are regenerated so browsers drop cached art. */
const BODY_ASSET_VERSION = "6";

export const HERO_BODY_TEXTURES = {
  male: { key: "hero-body-male", url: `/hero-body-male.png?v=${BODY_ASSET_VERSION}` },
  female: { key: "hero-body-female", url: `/hero-body-female.png?v=${BODY_ASSET_VERSION}` }
};

/**
 * Equipment slots a gender's body sheet already paints. The male sheet ships a
 * fully dressed character (hair, tunic, sash, trousers and boots), so stacking
 * the modular equipment sprites on top of it would double the clothing. Slots
 * listed here are skipped by the rig for that gender; hands keep their weapon
 * and accessory overlays because those are not part of the body art.
 * @type {Record<"male"|"female", string[]>}
 */
export const BODY_BAKED_SLOTS = {
  male: ["pants", "armor", "helmet"],
  female: []
};

/**
 * @param {"male"|"female"|string} [gender="male"]
 * @returns {string[]} equipment slots already drawn into the body sheet
 */
export function bakedEquipmentSlots(gender = "male") {
  return BODY_BAKED_SLOTS[normalizeGender(gender)] ?? [];
}

/**
 * Modular equipment textures mapping item IDs and gender variants to spritesheet keys and URLs.
 * All equipment spritesheets follow the exact same 4x4 (128x160 px/frame) grid geometry as HERO_BODY.
 */
export const HERO_EQUIPMENT_TEXTURES = {
  "non-lang-khach": {
    male: { key: "hero-hat-non-truc", url: `/hero-hat-non-truc.png?v=${BODY_ASSET_VERSION}` },
    female: { key: "hero-hat-non-mang", url: `/hero-hat-non-mang.png?v=${BODY_ASSET_VERSION}` }
  },
  "non-truc": {
    male: { key: "hero-hat-non-truc", url: `/hero-hat-non-truc.png?v=${BODY_ASSET_VERSION}` },
    female: { key: "hero-hat-non-truc", url: `/hero-hat-non-truc.png?v=${BODY_ASSET_VERSION}` }
  },
  "non-mang": {
    male: { key: "hero-hat-non-mang", url: `/hero-hat-non-mang.png?v=${BODY_ASSET_VERSION}` },
    female: { key: "hero-hat-non-mang", url: `/hero-hat-non-mang.png?v=${BODY_ASSET_VERSION}` }
  },
  "ao-lang-khach": {
    male: { key: "hero-armor-lang-khach-male", url: `/hero-armor-lang-khach-male.png?v=${BODY_ASSET_VERSION}` },
    female: { key: "hero-armor-lang-khach-female", url: `/hero-armor-lang-khach-female.png?v=${BODY_ASSET_VERSION}` }
  },
  "quan-lang-khach": {
    male: { key: "hero-pants-lang-khach-male", url: `/hero-pants-lang-khach-male.png?v=${BODY_ASSET_VERSION}` },
    female: { key: "hero-pants-lang-khach-male", url: `/hero-pants-lang-khach-male.png?v=${BODY_ASSET_VERSION}` }
  }
};

/**
 * Resolve the texture definition for an equipped item, taking gender into account.
 * @param {string} slot - Equipment slot ("helmet", "armor", etc.)
 * @param {string} itemId - Item ID ("non-truc", "ao-lang-khach", etc.)
 * @param {"male"|"female"|string} [gender="male"]
 * @returns {{ key: string, url: string }|null}
 */
export function equipmentTextureDef(slot, itemId, gender = "male") {
  if (!itemId || typeof itemId !== "string") return null;
  const entry = HERO_EQUIPMENT_TEXTURES[itemId];
  if (!entry) return null;
  const g = normalizeGender(gender);
  if (entry[g]) return entry[g];
  if (entry.male) return entry.male;
  if (entry.key && entry.url) return entry;
  return null;
}

/**
 * Resolve the Phaser texture key for an equipped item.
 * @param {string} slot
 * @param {string} itemId
 * @param {"male"|"female"|string} [gender="male"]
 * @returns {string|null}
 */
export function equipmentTextureKeyFor(slot, itemId, gender = "male") {
  return equipmentTextureDef(slot, itemId, gender)?.key ?? null;
}

/**
 * Static paper-doll art used by the character sheet (F3). Both files are
 * produced from `public/hero-body-new.png` by `scripts/build_preview_art.py`.
 * These are single idle poses with realistic proportions, so they are not a
 * drop-in replacement for the 4x4 walk sheets above.
 */
export const HERO_PREVIEW_ART = {
  male: { url: "/hero-preview-male.png", width: 480, height: 800, version: "2" },
  female: { url: "/hero-preview-female.png", width: 480, height: 800, version: "2" }
};

/**
 * Overlay equipment art used by the modular F3 paper-doll character sheet.
 */
export const HERO_PREVIEW_EQUIPMENT_LAYERS = {
  helmet: {
    "non-lang-khach": {
      male: { url: "/hero-preview-hat-non-truc.png", version: "1" },
      female: { url: "/hero-preview-hat-non-mang.png", version: "1" }
    }
  },
  armor: {
    "ao-lang-khach": {
      male: { url: "/hero-preview-armor-lang-khach-male.png", version: "1" },
      female: { url: "/hero-preview-armor-lang-khach-female.png", version: "1" }
    }
  },
  pants: {
    "quan-lang-khach": {
      male: { url: "/hero-preview-pants-lang-khach-male.png", version: "1" },
      female: { url: "/hero-preview-pants-lang-khach-female.png", version: "1" }
    }
  }
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

/** Sheet row for each of the eight facing directions (see heroDirections.js). */
const ROW_BY_DIRECTION = [0, 2, 2, 2, 3, 1, 1, 1];

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
