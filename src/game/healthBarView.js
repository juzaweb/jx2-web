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

const FILL_WIDTH = HEALTH_BAR_WIDTH - BAR_PADDING_X * 2;
const FILL_HEIGHT = HEALTH_BAR_HEIGHT - BAR_PADDING_Y * 2;

/**
 * Build the two rectangles that make up an overhead health bar. Only calls
 * methods on the scene it is handed, so the module stays free of any direct
 * Phaser import.
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y - character anchor Y; the bar is drawn above it
 * @returns {{back: object, fill: object}}
 */
export function createHealthBar(scene, x, y) {
  const barY = y - BAR_TOP_OFFSET;
  const back = scene.add
    .rectangle(x, barY, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT, BAR_BACK_COLOR)
    .setStrokeStyle(1, BAR_STROKE_COLOR)
    .setDepth(y + BAR_DEPTH_BACK);
  const fill = scene.add
    .rectangle(
      x - HEALTH_BAR_WIDTH / 2 + BAR_PADDING_X,
      barY,
      FILL_WIDTH,
      FILL_HEIGHT,
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
 */
export function layoutHealthBar(bar, x, overheadY, depthBase, hp, maxHp) {
  if (!bar?.back || !bar?.fill) return;

  const barY = overheadY - BAR_TOP_OFFSET;
  const { ratio, color } = healthBarStyle(hp, maxHp);

  bar.back.setPosition(x, barY);
  bar.back.setDepth(depthBase + BAR_DEPTH_BACK);

  bar.fill.width = FILL_WIDTH * ratio;
  bar.fill.setPosition(x - HEALTH_BAR_WIDTH / 2 + BAR_PADDING_X, barY);
  bar.fill.setDepth(depthBase + BAR_DEPTH_FILL);
  bar.fill.setFillStyle(color);
}
