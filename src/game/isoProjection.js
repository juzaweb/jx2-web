/**
 * Isometric projection for the game world.
 *
 * Game logic (physics, collisions, network positions, distances) stays in the
 * flat "ground plane" coordinate system used everywhere in `src/game`. Only the
 * *rendering* of visible objects is projected through here, which is what turns
 * the top-down world into a VLTK2-style 2:1 isometric view.
 *
 * The mapping is a standard diamond projection:
 *   screenX = (x - y) / 2
 *   screenY = (x + y) / 4
 * so a square ground tile of size `t` renders as a `t` wide and `t / 2` tall
 * diamond (2:1).
 */

/** Ratio of the diamond: 2 means width is twice the height. */
export const ISO_RATIO = 2;

const HALF = 1 / ISO_RATIO;
const QUARTER = 1 / (ISO_RATIO * 2);

/**
 * Project a ground-plane point to isometric screen space.
 * @param {number} x
 * @param {number} y
 * @returns {{x:number,y:number}}
 */
export function toIso(x, y) {
  return {
    x: (x - y) * HALF,
    y: (x + y) * QUARTER
  };
}

/**
 * Inverse of {@link toIso}: isometric screen space back to ground coordinates.
 * Used to turn mouse clicks on the tilted ground back into world positions.
 * @param {number} sx
 * @param {number} sy
 * @returns {{x:number,y:number}}
 */
export function fromIso(sx, sy) {
  return {
    x: sx + sy * 2,
    y: sy * 2 - sx
  };
}

/**
 * Painter's-order depth for an isometric object: objects with a larger ground
 * (x + y) are nearer the camera and must draw on top.
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function isoDepth(x, y) {
  return (x + y) * QUARTER;
}

/**
 * Isometric bounding box (screen space) of a `width × height` ground rectangle
 * anchored at the origin. Useful for camera bounds.
 * @param {number} width
 * @param {number} height
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}}
 */
export function isoBounds(width, height) {
  const corners = [toIso(0, 0), toIso(width, 0), toIso(width, height), toIso(0, height)];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}
