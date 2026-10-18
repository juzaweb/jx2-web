/**
 * Enemy AI for the wolf roster, shared by both runtimes:
 * - online: the server steps it on a fixed tick (`server/src/websocket/gameSocket.js`)
 *   and ships positions, so every player sees the same monsters move the same way;
 * - offline: the client steps it itself with the local player as the only target.
 *
 * Tuning mirrors the AI that used to live in src/game/enemy.js. Kept free of
 * Phaser/transport so the rules can be unit tested.
 */

/** Aggro/chase/home tuning shared by the server tick. */
export const ENEMY_TUNING = {
  aggroRange: 210,
  chaseSpeed: 43,
  stopDistance: 52,
  idleSpeed: 22,
  homeEpsilon: 10
};

/**
 * Nearest living player inside the aggro range.
 * @param {{x:number, y:number}} enemy
 * @param {Array<{id:string, x:number, y:number}>} players
 * @returns {?{id:string, x:number, y:number}} null when nobody is in range
 */
export function nearestPlayerInRange(enemy, players = []) {
  let nearest = null;
  let nearestDistance = Infinity;

  players.forEach((player) => {
    if (!Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;

    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (distance < ENEMY_TUNING.aggroRange && distance < nearestDistance) {
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
 * @param {{x:number, y:number, homeX:number, homeY:number}} enemy
 * @param {Array<Object>} players
 * @param {number} deltaMs
 * @returns {{x:number, y:number}} authoritative next position
 */
export function stepEnemy(enemy, players = [], deltaMs = 0) {
  const seconds = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0) / 1000;
  const target = nearestPlayerInRange(enemy, players);

  if (target) {
    const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
    if (distance <= ENEMY_TUNING.stopDistance) {
      return { x: enemy.x, y: enemy.y };
    }
    // Stop at the stop distance: a long tick must not walk the wolf onto the player
    const advance = Math.min(
      ENEMY_TUNING.chaseSpeed * seconds,
      distance - ENEMY_TUNING.stopDistance
    );
    return moveToward(enemy, target.x, target.y, advance);
  }

  const homeDistance = Math.hypot(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
  if (homeDistance <= ENEMY_TUNING.homeEpsilon) {
    return { x: enemy.x, y: enemy.y };
  }
  return moveToward(enemy, enemy.homeX, enemy.homeY, ENEMY_TUNING.idleSpeed * seconds);
}
