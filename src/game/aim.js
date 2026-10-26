/**
 * Targeting helpers shared by the client and the authoritative server.
 *
 * Kept free of Phaser/React imports so the Node server can load it directly and
 * client/server range maths cannot drift apart.
 */

/**
 * Pull `point` back to `maxRange` around `origin`, preserving its direction.
 * Returns the point unchanged when it is already inside the range.
 * @param {{x:number,y:number}} origin
 * @param {{x:number,y:number}} point
 * @param {number} maxRange
 * @returns {{x:number,y:number}}
 */
export function clampToRange(origin, point, maxRange) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const limit = Number.isFinite(maxRange) ? Math.max(0, maxRange) : Infinity;
  if (!distance || distance <= limit) return { x: point.x, y: point.y };
  const scale = limit / distance;
  return { x: origin.x + dx * scale, y: origin.y + dy * scale };
}
