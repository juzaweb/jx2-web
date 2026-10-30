/**
 * Client-side targeting helpers for player-versus-player combat.
 *
 * `pvp.js` holds the rules both the client and the server enforce (flags, range,
 * damage clamp). This module only maps user intent — a click on a peer, or the
 * attack button — onto a remote player. It stays free of Phaser imports so it
 * can be unit tested in isolation.
 */

import { PVP_ATTACK_RANGE, PVP_MODE } from "./pvp.js";
import { isHostileFaction } from "./factions.js";

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
  // Use squared distance to avoid expensive Math.hypot square roots in target search.
  let bestDistSq = Infinity;
  for (const player of players) {
    if (!isPointOnPlayer(player, x, y)) continue;

    const dx = player.x - x;
    const dy = player.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      best = player;
      bestDistSq = distSq;
    }
  }
  return best;
}

/**
 * Whether a peer is a legal duel candidate on this map.
 *
 * `flag` maps only offer players who opted in; `faction` maps offer every peer
 * from a different camp, whether or not either side raised the flag.
 * @param {{faction?:string}|null} attacker
 * @param {{pkFlag?:boolean, faction?:string}} player
 * @param {"none"|"flag"|"faction"} pvpMode
 * @returns {boolean}
 */
export function isDuelCandidate(attacker, player, pvpMode = PVP_MODE.FLAG) {
  if (pvpMode === PVP_MODE.NONE) return false;
  if (pvpMode === PVP_MODE.FACTION) return isHostileFaction(attacker?.faction, player?.faction);
  return player?.pkFlag === true;
}

/**
 * The closest legal duel target within striking range of `attacker`.
 *
 * The attacker's own PK flag is checked by `canPvpAttack` at strike time, so a
 * peaceful attacker in flag mode still gets the "turn your flag on first" hint
 * instead of silence. On a faction battlefield the camp is enough.
 * @param {{x:number,y:number,id?:string,faction?:string}|null} attacker
 * @param {Array<{x:number,y:number,id?:string,pkFlag?:boolean,faction?:string}>} players
 * @param {number} [maxRange=PVP_ATTACK_RANGE]
 * @param {"none"|"flag"|"faction"} [pvpMode="flag"]
 * @returns {object|null}
 */
export function findNearestPvpTarget(
  attacker,
  players,
  maxRange = PVP_ATTACK_RANGE,
  pvpMode = PVP_MODE.FLAG
) {
  if (!attacker || !Array.isArray(players)) return null;
  if (typeof attacker.x !== "number" || typeof attacker.y !== "number") return null;

  const ax = attacker.x;
  const ay = attacker.y;
  const maxRangeSq = maxRange * maxRange;

  let best = null;
  // Use squared distance to avoid expensive Math.hypot square roots in loop over players.
  let bestDistSq = Infinity;
  for (const player of players) {
    if (!isLive(player)) continue;
    if (!isDuelCandidate(attacker, player, pvpMode)) continue;
    if (attacker.id && player.id === attacker.id) continue;

    const dx = player.x - ax;
    const dy = player.y - ay;
    const distSq = dx * dx + dy * dy;
    if (distSq <= maxRangeSq && distSq < bestDistSq) {
      best = player;
      bestDistSq = distSq;
    }
  }
  return best;
}
