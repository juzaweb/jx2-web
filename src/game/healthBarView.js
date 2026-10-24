import {
  HEALTH_BAR_HEIGHT,
  HEALTH_BAR_WIDTH,
  HEALTH_COLOR_HEALTHY,
  healthBarStyle
} from "./healthBar.js";

const BAR_BACK_COLOR = 0x1b1714;
const BAR_STROKE_COLOR = 0x081008;

/** World units the bar sits above the character's anchor Y. */
const BAR_TOP_OFFSET = 50;
const BAR_DEPTH_BACK = 101;
const BAR_DEPTH_FILL = 102;

/** Margin (px) kept between the fill and the back plate. */
const BAR_PADDING_X = 2;
const BAR_PADDING_Y = 1;

/**
 * Build the two rectangles that make up an overhead health bar. Only calls
 * methods on the scene it is handed, so the module stays free of any direct
 * Phaser import.
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y - character anchor Y; the bar is drawn above it
 * @param {number} [scale=1] - world scale so the bar matches a scaled character
 * @returns {{back: object, fill: object}}
 */
export function createHealthBar(scene, x, y, scale = 1) {
  const barY = y - BAR_TOP_OFFSET * scale;
  const width = HEALTH_BAR_WIDTH * scale;
  const height = HEALTH_BAR_HEIGHT * scale;
  const back = scene.add
    .rectangle(x, barY, width, height, BAR_BACK_COLOR)
    .setStrokeStyle(1, BAR_STROKE_COLOR)
    .setDepth(y + BAR_DEPTH_BACK);
  const fill = scene.add
    .rectangle(
      x - width / 2 + BAR_PADDING_X * scale,
      barY,
      (HEALTH_BAR_WIDTH - BAR_PADDING_X * 2) * scale,
      (HEALTH_BAR_HEIGHT - BAR_PADDING_Y * 2) * scale,
      HEALTH_COLOR_HEALTHY
    )
    .setOrigin(0, 0.5)
    .setDepth(y + BAR_DEPTH_FILL);

  return { back, fill };
}

/**
 * Position and recolour an overhead bar for the given health.
 * @param {{back?:object, fill?:object}} bar
 * @param {number} x
 * @param {number} overheadY - world Y the bar tracks (may include a walk bob)
 * @param {number} depthBase - stable Y used for depth sorting, so the bar does
 *   not flicker behind the name when the character bobs
 * @param {number} hp
 * @param {number} maxHp
 * @param {number} [scale=1] - world scale so the bar matches a scaled character
 */
export function layoutHealthBar(bar, x, overheadY, depthBase, hp, maxHp, scale = 1) {
  if (!bar?.back || !bar?.fill) return;

  const barY = overheadY - BAR_TOP_OFFSET * scale;
  const width = HEALTH_BAR_WIDTH * scale;
  const { ratio, color } = healthBarStyle(hp, maxHp);
  const fillWidth = (HEALTH_BAR_WIDTH - BAR_PADDING_X * 2) * scale * ratio;
  const fillHeight = (HEALTH_BAR_HEIGHT - BAR_PADDING_Y * 2) * scale;

  bar.back.setPosition(x, barY);
  bar.back.setDepth(depthBase + BAR_DEPTH_BACK);

  // `setSize` (not `fill.width = ...`): a Phaser Rectangle only rebuilds its drawn
  // geometry through setSize, so assigning the property left every bar rendering at
  // full width while only the hp number changed behind it.
  if (typeof bar.fill.setSize === "function") {
    bar.fill.setSize(fillWidth, fillHeight);
  } else {
    bar.fill.width = fillWidth;
  }
  bar.fill.setPosition(x - width / 2 + BAR_PADDING_X * scale, barY);
  bar.fill.setDepth(depthBase + BAR_DEPTH_FILL);
  bar.fill.setFillStyle(color);
}
