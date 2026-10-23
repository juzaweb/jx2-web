/**
 * Deterministic 0–1 noise shared by the map data and the renderer.
 *
 * Hand-rolled on purpose: the map layout must be *identical* on every reload and
 * on every machine, so nothing here may touch `Math.random()`. Same input, same
 * output, forever.
 */

/**
 * @param {number} seed Any number; reused with different salts for variety.
 * @param {number} [salt] Distinguishes independent streams.
 * @param {number} [offset] Shifts the stream.
 * @returns {number} A stable value in the range [0, 1).
 */
export function noise01(seed, salt = 12.9898, offset = 78.233) {
  const v = Math.sin(seed * salt + offset) * 43758.5453;
  return v - Math.floor(v);
}
