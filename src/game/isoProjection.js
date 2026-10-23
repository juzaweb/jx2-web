/**
 * Screen projection for the game world.
 *
 * The reference market square is drawn as a top-down 2.5D scene: the ground is
 * a screen-aligned grid of rectangular stone bricks and characters move on the
 * flat plane, while buildings use front-facing pseudo-perspective art. Ground
 * coordinates therefore map 1:1 to screen space (`x`, `y`), and depth sorting is
 * simply the ground `y`.
 *
 * The function names are kept from the previous isometric implementation so
 * gameplay code (physics, clicks, network positions, minimap) needs no changes.
 */

/**
 * Project a ground-plane point to screen space.
 * @param {number} x
 * @param {number} y
 * @returns {{x:number,y:number}}
 */
export function toIso(x, y) {
  return { x, y };
}

/**
 * Inverse of {@link toIso}.
 * @param {number} sx
 * @param {number} sy
 * @returns {{x:number,y:number}}
 */
export function fromIso(sx, sy) {
  return { x: sx, y: sy };
}

/**
 * Painter's-order depth: objects lower on screen (larger ground `y`) draw on top.
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function isoDepth(x, y) {
  return y;
}

/**
 * Bounding box (screen space) of a `width × height` ground rectangle.
 * @param {number} width
 * @param {number} height
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}}
 */
export function isoBounds(width, height) {
  return { minX: 0, minY: 0, maxX: width, maxY: height };
}
