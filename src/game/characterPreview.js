/**
 * Character-sheet preview geometry.
 *
 * The F3 paper doll uses the same baked body sheet and equipment overlays as
 * the in-game hero, so the preview always matches what other players see.
 */

import { HERO_BODY, HERO_BODY_TEXTURES, bodyFrameForDirection } from "./heroBody.js";
import { buildBodyEquipment } from "./heroBodyEquipment.js";
import { normalizeGender } from "./gender.js";

/** Fraction of the background image one frame occupies. */
const toPercent = (index, count) => (count > 1 ? (index / (count - 1)) * 100 : 0);

/**
 * Resolve the preview sprite frame and the SVG overlay geometry.
 * @param {{gender?:"male"|"female", direction?:number, equipment?:Record<string,string|null>}} [opts]
 * @returns {{
 *   textureUrl: string,
 *   backgroundSize: string,
 *   backgroundPosition: string,
 *   aspectRatio: string,
 *   viewBox: string,
 *   parts: Array<Object>
 * }}
 */
export function buildCharacterPreview({ gender = "male", direction = 0, equipment = {} } = {}) {
  const g = normalizeGender(gender);
  const { frameWidth, frameHeight, columns, rows, scale } = HERO_BODY;
  const frame = bodyFrameForDirection(direction, 0);
  const column = frame % columns;
  const row = Math.floor(frame / columns);

  const margin = HERO_BODY.footOffsetY / scale;
  const viewWidth = frameWidth * scale;
  const viewHeight = frameHeight * scale;
  const viewX = -(frameWidth / 2) * scale;
  const viewY = -(frameHeight - margin) * scale;

  return {
    textureUrl: HERO_BODY_TEXTURES[g].url,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${toPercent(column, columns)}% ${toPercent(row, rows)}%`,
    aspectRatio: `${frameWidth} / ${frameHeight}`,
    viewBox: `${viewX} ${viewY} ${viewWidth} ${viewHeight}`,
    parts: buildBodyEquipment({ direction, equipment })
  };
}
