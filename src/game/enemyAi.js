/**
 * Enemy AI for the wolf roster, shared by both runtimes:
 * - online: the server steps it on a fixed tick (`server/src/websocket/gameSocket.js`)
 *   and ships positions, so every player sees the same monsters move the same way;
 * - offline: the client steps it itself with the local player as the only target.
 *
 * Tuning mirrors the AI that used to live in src/game/enemy.js. Kept free of
 * Phaser/transport so the rules can be unit tested.
 */

import { WORLD_POSITION_SCALE as POS, WORLD_SCALE, WORLD_SPEED_SCALE } from "./worldConfig.js";

/** Aggro/chase/home tuning shared by the server tick. */
export const ENEMY_TUNING = {
  aggroRange: 210 * WORLD_SCALE,
  chaseSpeed: 43 * POS * WORLD_SPEED_SCALE,
  stopDistance: 52 * WORLD_SCALE,
  idleSpeed: 22 * POS * WORLD_SPEED_SCALE,
  homeEpsilon: 10 * WORLD_SCALE,
  // How far a monster may stray from its spawn before it gives up the chase and
  // walks home. Keeps one hunting camp from emptying into the next one.
  leashRange: 560 * WORLD_SCALE
};

/**
 * The wolf's combat block, owned here so the client renderer (`src/game/enemy.js`)
 * and the server bite roll (`server/.../gameSocket.js`) can never drift apart.
 */
export const WOLF_COMBAT = {
  attack: 12,
  defense: 3,
  critRate: 0.05,
  critDamage: 1.5
};

/** How close a wolf must be to bite, and how often it may (both client & server). */
export const BITE_TUNING = {
  range: 55 * WORLD_SCALE,
  cooldownMs: 1400
};

/**
 * Nearest living player inside the aggro range.
 *
 * A monster may carry its own `tuning` block (see `src/game/enemyCatalog.js`);
 * anything missing falls back to the shared defaults, so a plain `{x, y}` enemy
 * behaves exactly like the legacy wolf.
 * @param {{x:number, y:number, tuning?:object}} enemy
 * @param {Array<{id:string, x:number, y:number}>} players
 * @returns {?{id:string, x:number, y:number}} null when nobody is in range
 */
export function nearestPlayerInRange(enemy, players = [], tuning = enemy?.tuning || ENEMY_TUNING) {
  const tuningBlock = tuning || ENEMY_TUNING;
  let nearest = null;
  let nearestDistance = Infinity;

  players.forEach((player) => {
    if (!Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;

    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (distance < tuningBlock.aggroRange && distance < nearestDistance) {
      nearest = player;
      nearestDistance = distance;
    }
  });

  return nearest;
}

/**
 * Move `maxStep` px from the enemy toward (targetX, targetY) without overshooting.
 * Returns unrounded positions: the caller decides the grid it stores (the server
 * broadcasts whole pixels, the offline client keeps the smooth float).
 * @returns {{x:number, y:number}}
 */
const moveToward = (enemy, targetX, targetY, maxStep) => {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0 || maxStep <= 0) {
    return { x: enemy.x, y: enemy.y };
  }

  const step = Math.min(maxStep, distance);
  return {
    x: enemy.x + (dx / distance) * step,
    y: enemy.y + (dy / distance) * step
  };
};

/**
 * Advance one enemy by `deltaMs`: chase the nearest player in range, hold
 * position once inside the stop distance, otherwise walk back home.
 * The caller owns the dead check (the server skips `isDead` enemies before
 * stepping them).
 * @param {{x:number, y:number, homeX:number, homeY:number, tuning?:object}} enemy
 * @param {Array<Object>} players
 * @param {number} deltaMs
 * @returns {{x:number, y:number}} authoritative next position
 */
export function stepEnemy(enemy, players = [], deltaMs = 0) {
  const tuning = enemy?.tuning || ENEMY_TUNING;
  const seconds = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0) / 1000;
  const target = nearestPlayerInRange(enemy, players, tuning);
  const leash = tuning.leashRange ?? ENEMY_TUNING.leashRange;
  // The leash is measured on the *player*, not on the monster: a camp defends the
  // ground around its spawn and cannot be pulled across the map. Measuring the
  // player keeps the rule stateless, so there is no chase/return oscillation at
  // the boundary — the hero simply has to leave the camp for the chase to end.
  const defended =
    target && Math.hypot(target.x - enemy.homeX, target.y - enemy.homeY) <= leash;

  if (defended) {
    const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
    if (distance <= tuning.stopDistance) {
      return { x: enemy.x, y: enemy.y };
    }
    // Stop at the stop distance: a long tick must not walk the monster onto the player
    const advance = Math.min(tuning.chaseSpeed * seconds, distance - tuning.stopDistance);
    return moveToward(enemy, target.x, target.y, advance);
  }

  const homeDistance = Math.hypot(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
  if (homeDistance <= tuning.homeEpsilon) {
    return { x: enemy.x, y: enemy.y };
  }
  return moveToward(enemy, enemy.homeX, enemy.homeY, tuning.idleSpeed * seconds);
}
