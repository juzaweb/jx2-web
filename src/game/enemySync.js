/**
 * Pure reconciliation rules for server-authoritative enemy state.
 * Kept free of Phaser so the rules can be unit tested.
 */

/** Distance (px) the server snapshot may drift before a client snaps to it. */
export const POSITION_SNAP_THRESHOLD = 90;

/**
 * Clamp a server-provided HP value into a usable range.
 * @param {number} hp
 * @param {number} maxHp
 * @returns {number|null} clamped hp, or null when the value is unusable
 */
export function sanitizeHp(hp, maxHp) {
  if (typeof hp !== "number" || !Number.isFinite(hp)) return null;
  const ceiling = typeof maxHp === "number" && Number.isFinite(maxHp) && maxHp > 0 ? maxHp : hp;
  return Math.min(Math.max(hp, 0), ceiling);
}

/**
 * Decide which parts of a server enemy snapshot a client should apply.
 *
 * HP and the dead flag are always taken from the server, so every client in
 * range agrees on the remaining health. Position is only snapped for a living
 * enemy that drifted far enough to be a real correction rather than local AI
 * noise — a corpse keeps the spot where it fell.
 *
 * @param {{x:number,y:number,hp:number,maxHp:number,isDead:boolean}} local
 * @param {{x?:number,y?:number,hp?:number,isDead?:boolean}} server
 * @param {number} [threshold]
 * @returns {{hp:number, isDead:boolean, snap:boolean}}
 */
export function reconcileEnemyState(local, server = {}, threshold = POSITION_SNAP_THRESHOLD) {
  const serverHp = sanitizeHp(server.hp, local.maxHp);
  const hp = serverHp === null ? local.hp : serverHp;
  const isDead = server.isDead === true || hp <= 0;
  const hasPosition = Number.isFinite(server.x) && Number.isFinite(server.y);
  const snap = !isDead && hasPosition && Math.hypot(server.x - local.x, server.y - local.y) > threshold;

  return { hp, isDead, snap };
}
