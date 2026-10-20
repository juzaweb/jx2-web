/**
 * Pure rules for the throttled position the local player reports to the server.
 * Kept free of Phaser so the rules can be unit tested.
 */

/** Distance (px) a resting player may jump between reports before it counts as a teleport. */
export const TELEPORT_REPORT_THRESHOLD = 120;

/**
 * Decide whether the local player's position must be reported this tick.
 *
 * The normal gate is "only while moving", plus one final packet on the stop
 * transition so peers settle on the exact resting spot. A respawn or a Hồi
 * Thành Phù teleport moves the player while stationary, so a jump larger than
 * `threshold` since the last reported spot must also force a packet —
 * otherwise peers keep rendering the player at the stale position.
 *
 * @param {{isMoving:boolean, wasMoving:boolean, x:number, y:number, lastReported?:{x:number,y:number}|null}} state
 * @param {number} [threshold]
 * @returns {boolean}
 */
export function shouldReportPosition(state = {}, threshold = TELEPORT_REPORT_THRESHOLD) {
  const { isMoving, wasMoving, x, y, lastReported } = state;

  if (isMoving || wasMoving) return true;
  // Nothing reported yet: send the current spot so peers never start stale.
  if (!lastReported) return true;

  return Math.hypot(x - lastReported.x, y - lastReported.y) > threshold;
}
