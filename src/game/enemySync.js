/**
 * Pure reconciliation rules for server-authoritative enemy state.
 * Kept free of Phaser so the rules can be unit tested.
 */

/** Distance (px) the server snapshot may drift before a client snaps to it. */
export const POSITION_SNAP_THRESHOLD = 90;

/** Distance (px) at which a smoothed enemy settles exactly on the server spot. */
export const POSITION_SETTLE_EPSILON = 1;

/** Time constant (ms) of the exponential blend toward the server position. */
export const POSITION_SMOOTHING_MS = 120;

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
 * range agrees on the remaining health. Position is snapped outright only for a
 * living enemy that moved far enough to be a warp (respawn or teleport) —
 * anything closer is smoothed toward the snapshot by
 * `interpolateEnemyPosition`, and a corpse keeps the spot where it fell.
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

/**
 * Smooth a rendered enemy position toward the authoritative server position so
 * movement stays fluid between ticks. Frame-rate independent, never overshoots,
 * and settles exactly on the target so an enemy at rest stops being redrawn.
 * @param {{x:number, y:number}} current
 * @param {{x:number, y:number}} target
 * @param {number} deltaMs - frame delta
 * @param {number} [smoothingMs] - time constant of the blend
 * @returns {{x:number, y:number}}
 */
export function interpolateEnemyPosition(current, target, deltaMs, smoothingMs = POSITION_SMOOTHING_MS) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;

  if (Math.hypot(dx, dy) <= POSITION_SETTLE_EPSILON) {
    return { x: target.x, y: target.y };
  }

  const dt = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
  const blend = 1 - Math.exp(-dt / Math.max(1, smoothingMs));

  return { x: current.x + dx * blend, y: current.y + dy * blend };
}
