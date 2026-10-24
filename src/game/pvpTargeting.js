/**
 * Client-side targeting helpers for player-versus-player combat.
 *
 * `pvp.js` holds the rules both the client and the server enforce (flags, range,
 * damage clamp). This module only maps user intent — a click on a peer, or the
 * attack button — onto a remote player. It stays free of Phaser imports so it
 * can be unit tested in isolation.
 */

import { PVP_ATTACK_RANGE } from "./pvp.js";

/**
 * Clickable body box around a remote hero's feet, in world px. The peer is drawn
 * ~460 px tall (heroBody.js content at WORLD_SCALE), so a feet-to-feet radius
 * would leave the visible torso unclickable. Same convention as `isPointOnNpc`.
 */
export const PLAYER_HIT_BOX = { halfWidth: 90, aboveFeet: 460, belowFeet: 45 };

/**
 * Distance (world px) the duel chase closes to before striking. The server accepts
 * a hit anywhere inside `PVP_ATTACK_RANGE`, but stopping at the server limit would
 * leave the hero swinging at a target across the screen.
 */
export const PVP_CHASE_DISTANCE = 140;

/**
 * A remote player whose visuals have not been torn down yet.
 * Mocks used in tests may have no container at all, so that is not a rejection.
 * @param {*} player
 * @returns {boolean}
 */
function isLive(player) {
  if (!player || typeof player.x !== "number" || typeof player.y !== "number") return false;
  if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) return false;
  return player.container === undefined || player.container === null || player.container.active !== false;
}

/**
 * Whether a world-space point lands on a peer's drawn body. The rig is anchored
 * at the feet and extends upward, so the anchor alone would miss the torso.
 * @param {{x:number,y:number}} player
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isPointOnPlayer(player, x, y) {
  if (!isLive(player)) return false;
  return (
    Math.abs(x - player.x) < PLAYER_HIT_BOX.halfWidth &&
    y < player.y + PLAYER_HIT_BOX.belowFeet &&
    y > player.y - PLAYER_HIT_BOX.aboveFeet
  );
}

/**
 * The remote player standing under a world-space point, if any. Used to turn a
 * left click into a duel target instead of a walk.
 * @param {Array<{x:number,y:number}>} players
 * @param {number} x
 * @param {number} y
 * @returns {object|null}
 */
export function findPlayerAt(players, x, y) {
  if (!Array.isArray(players)) return null;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  let best = null;
  let bestDistance = Infinity;
  for (const player of players) {
    if (!isPointOnPlayer(player, x, y)) continue;

    const distance = Math.hypot(player.x - x, player.y - y);
    if (distance < bestDistance) {
      best = player;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The closest PK-flagged player within striking range of `attacker`. The
 * attacker's own flag is checked by `canPvpAttack` at strike time, so a peaceful
 * attacker still gets the "turn your flag on first" hint instead of silence.
 * @param {{x:number,y:number,id?:string}|null} attacker
 * @param {Array<{x:number,y:number,id?:string,pkFlag?:boolean}>} players
 * @param {number} [maxRange=PVP_ATTACK_RANGE]
 * @returns {object|null}
 */
export function findNearestPvpTarget(attacker, players, maxRange = PVP_ATTACK_RANGE) {
  if (!attacker || !Array.isArray(players)) return null;
  if (typeof attacker.x !== "number" || typeof attacker.y !== "number") return null;

  let best = null;
  let bestDistance = Infinity;
  for (const player of players) {
    if (!isLive(player)) continue;
    if (player.pkFlag !== true) continue;
    if (attacker.id && player.id === attacker.id) continue;

    const distance = Math.hypot(player.x - attacker.x, player.y - attacker.y);
    if (distance <= maxRange && distance < bestDistance) {
      best = player;
      bestDistance = distance;
    }
  }
  return best;
}
