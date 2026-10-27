/**
 * Pure rules for player-versus-player combat.
 *
 * The server owns every player's health: a client reports the damage number it
 * rolled, but the server validates flags/range/damage here before applying it to
 * the target's authoritative HP. Both the client (to gate the click) and the
 * server (to enforce) import this module so the rules never drift apart.
 */

import { WORLD_TILE } from "./worldConfig.js";
import { isHostileFaction } from "./factions.js";
import { PVP_MODE } from "./maps/mapRegistry.js";

export { PVP_MODE };

/**
 * Max distance at which one flagged player can strike another.
 *
 * Measured in ground tiles (1 tile = `WORLD_TILE` world units = one paving grid
 * cell ~= 2.4 hero heights), because that is the unit the player actually sees.
 * Raw world units are useless as a design knob here: the camera is zoomed far out,
 * so 600 units look like "standing next to each other" while the server refuses.
 */
export const PVP_ATTACK_RANGE = 3 * WORLD_TILE;

/** Hard ceiling on a single reported hit, mirroring the server's enemy clamp. */
export const PVP_MAX_DAMAGE = 200;

/**
 * Invulnerability window (ms) the server grants after it applies a player hit.
 * Shared so the client can pace its strikes to it instead of firing faster than
 * the server will accept.
 */
export const PLAYER_IFRAME_MS = 700;

/** Min gap (ms) between two PvP strikes from the same attacker. */
export const PVP_HIT_COOLDOWN_MS = PLAYER_IFRAME_MS + 50;

/**
 * Ceiling of the directional dodge chance. Base PvP is a guaranteed hit; only a
 * target that actively runs *away* from the strike can slip it, and even then at
 * most this often. Running sideways, running in, or standing still never dodges.
 */
export const PVP_MAX_DODGE = 0.35;

/** Below this speed (world units/s) the target counts as standing still. */
export const PVP_DODGE_MIN_SPEED = 15;

/**
 * Distance a PvP approach closes to before releasing. Deliberately inside
 * `PVP_ATTACK_RANGE`: the server measures the distance from its own (slightly
 * older) copy of both positions, so casting exactly at the limit gets refused as
 * out of range while the client swears it is in range.
 */
export const PVP_CAST_DISTANCE = PVP_ATTACK_RANGE - 100;

/**
 * Whether a player is allowed to look for a duel target at all. In a faction
 * battlefield the map itself opts everyone in; elsewhere the PK flag does.
 * @param {{pkFlag?:boolean}|null} player
 * @param {"none"|"flag"|"faction"} [pvpMode]
 * @returns {boolean}
 */
export function mayDuel(player, pvpMode = PVP_MODE.FLAG) {
  if (pvpMode === PVP_MODE.NONE) return false;
  if (pvpMode === PVP_MODE.FACTION) return true;
  return player?.pkFlag === true;
}

/**
 * Whether two players are enemies regardless of distance.
 *
 * `flag` keeps the historical rule (both sides opted in). `faction` replaces the
 * flag with camp hostility: two known, different camps are enemies, and an
 * unknown camp never is.
 * @param {{id?:string, pkFlag?:boolean, faction?:string}|null} attacker
 * @param {{id?:string, pkFlag?:boolean, faction?:string}|null} target
 * @param {"none"|"flag"|"faction"} [pvpMode]
 * @returns {boolean}
 */
export function pvpFoes(attacker, target, pvpMode = PVP_MODE.FLAG) {
  if (!attacker || !target) return false;

  const attackerId = attacker.id;
  const targetId = target.id;
  if (!attackerId || !targetId || attackerId === targetId) return false;

  if (pvpMode === PVP_MODE.NONE) return false;
  if (pvpMode === PVP_MODE.FACTION) return isHostileFaction(attacker.faction, target.faction);
  return attacker.pkFlag === true && target.pkFlag === true;
}

/**
 * Decide whether one player is allowed to strike another.
 *
 * Both parties must carry the PK flag on a normal map: a peaceful player can
 * neither attack nor be attacked, which keeps the flag meaningful as an explicit
 * opt-in. On a faction battlefield the camp decides instead (see `pvpFoes`).
 *
 * @param {{id?:string, pkFlag?:boolean, faction?:string}|null} attacker
 * @param {{id?:string, pkFlag?:boolean, faction?:string}|null} target
 * @param {number} distance - world-space distance between the two players
 * @param {number} [maxRange=PVP_ATTACK_RANGE]
 * @param {"none"|"flag"|"faction"} [pvpMode="flag"]
 * @returns {boolean}
 */
export function canPvpAttack(
  attacker,
  target,
  distance,
  maxRange = PVP_ATTACK_RANGE,
  pvpMode = PVP_MODE.FLAG
) {
  if (!pvpFoes(attacker, target, pvpMode)) return false;

  if (typeof distance !== "number" || !Number.isFinite(distance)) return false;
  return distance <= maxRange;
}

/**
 * Clamp an untrusted damage report into a usable whole number.
 * @param {*} damage
 * @returns {number|null} null when the value cannot be trusted
 */
export function clampPvpDamage(damage) {
  if (typeof damage !== "number" || !Number.isFinite(damage) || damage <= 0) return null;
  return Math.round(Math.min(damage, PVP_MAX_DAMAGE));
}

/**
 * Chance that a target escapes a strike by running away from it.
 *
 * `0` unless the target is genuinely retreating along the line of the attack:
 * the fleeing component is the angle between the target's velocity and the vector
 * from attacker to target, so a perpendicular dash (a sidestep) does not count and
 * neither does charging straight in.
 *
 * @param {{x:number,y:number}} attacker
 * @param {{x:number,y:number,vx?:number,vy?:number}} target
 * @returns {number} chance in [0, PVP_MAX_DODGE]
 */
export function dodgeChance(attacker, target) {
  if (!attacker || !target) return 0;

  const vx = Number(target.vx) || 0;
  const vy = Number(target.vy) || 0;
  const speed = Math.hypot(vx, vy);
  if (speed < PVP_DODGE_MIN_SPEED) return 0;

  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const separation = Math.hypot(dx, dy);
  if (!separation) return 0;

  // cos(angle) between "where I am running" and "away from the attacker".
  const fleeing = (vx * dx + vy * dy) / (speed * separation);
  if (!Number.isFinite(fleeing) || fleeing <= 0) return 0;
  return Math.min(1, fleeing) * PVP_MAX_DODGE;
}

/**
 * Decide one strike against the directional dodge rule.
 * @param {{x:number,y:number}} attacker
 * @param {{x:number,y:number,vx?:number,vy?:number}} target
 * @param {number} roll uniform sample in [0, 1)
 * @returns {boolean} true when the strike is dodged
 */
export function rollDodge(attacker, target, roll) {
  const chance = dodgeChance(attacker, target);
  if (chance <= 0) return false;
  if (typeof roll !== "number" || !Number.isFinite(roll)) return false;
  return roll < chance;
}
