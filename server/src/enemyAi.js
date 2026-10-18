/**
 * Server-side enemy AI. Enemy movement used to run on every client, which meant
 * two players watching the same wolf saw it pulled toward their own character;
 * the server now owns it and ships positions on a fixed tick.
 *
 * Tuning mirrors the original client AI (src/game/enemy.js) so the monsters feel
 * unchanged. Kept free of transport/Phaser so the rules can be unit tested.
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
 * Rounded to the 1 px grid the server broadcasts, so the next tick compares
 * exactly and an enemy at rest stops producing updates.
 * @returns {{x:number, y:number}}
 */
const moveToward = (enemy, targetX, targetY, maxStep) => {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0 || maxStep <= 0) {
    return { x: Math.round(enemy.x), y: Math.round(enemy.y) };
  }

  const step = Math.min(maxStep, distance);
  return {
    x: Math.round(enemy.x + (dx / distance) * step),
    y: Math.round(enemy.y + (dy / distance) * step)
  };
};

/**
 * Advance one living enemy by `deltaMs`: chase the nearest player in range, hold
 * position once inside the stop distance, otherwise walk back home.
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
      return { x: Math.round(enemy.x), y: Math.round(enemy.y) };
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
    return { x: Math.round(enemy.x), y: Math.round(enemy.y) };
  }
  return moveToward(enemy, enemy.homeX, enemy.homeY, ENEMY_TUNING.idleSpeed * seconds);
}
