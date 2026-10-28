/**
 * Pure NPC proximity rules shared by the Phaser scene and the Node server.
 *
 * The server validates every quest/shop interaction against its own copy of the
 * hero position, so this module must stay free of Phaser and DOM imports.
 */

/**
 * How close (ground px) the hero must stand before an NPC can be talked to.
 *
 * Matches the historical shop radius (the sprite is ~257 world px wide, so a
 * smaller radius made the hero stand visually on top of the NPC before the game
 * agreed it was "near") and the server's shop range.
 */
export const NPC_INTERACT_RANGE = 260;

/** Clickable body box, measured in ground px around the NPC's feet. */
const HIT_HALF_WIDTH = 90;
const HIT_ABOVE_FEET = 460;
const HIT_BELOW_FEET = 45;
/** Where the hero stops so the NPC is inside talking range, not underfoot. */
const APPROACH_OFFSET = 60;

/**
 * Whether a ground-space point lands on the NPC's drawn body. The sprite is
 * anchored at the feet and extends upward, so using the anchor alone would make
 * the visible torso unclickable.
 * @param {{gx:number, gy:number}} npc
 * @param {number} x ground-space x
 * @param {number} y ground-space y
 * @returns {boolean}
 */
export function isPointOnNpc(npc, x, y) {
  if (!npc) return false;
  return (
    Math.abs(x - npc.gx) < HIT_HALF_WIDTH &&
    y < npc.gy + HIT_BELOW_FEET &&
    y > npc.gy - HIT_ABOVE_FEET
  );
}

/**
 * Whether a ground point is close enough to talk to this NPC.
 * @param {{gx:number, gy:number}} npc
 * @param {number} x ground-space x
 * @param {number} y ground-space y
 * @returns {boolean}
 */
export function isInTalkRange(npc, x, y) {
  if (!npc) return false;
  if (isPointOnNpc(npc, x, y)) return true;
  const dx = x - npc.gx;
  const dy = y - npc.gy;
  return dx * dx + dy * dy <= NPC_INTERACT_RANGE * NPC_INTERACT_RANGE;
}

/**
 * Ground point just in front of the NPC that the hero should walk to before
 * talking. Targeting the feet would make the hero collide with the NPC's body.
 * @param {{gx:number, gy:number}} npc
 * @returns {{x:number, y:number}}
 */
export function npcApproachPoint(npc) {
  return { x: npc.gx, y: npc.gy + APPROACH_OFFSET };
}
