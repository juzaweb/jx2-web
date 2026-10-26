/**
 * Auto-targeting for the touch layout.
 *
 * The on-screen controls have no cursor to aim with, so the scene picks the
 * most relevant victim itself and rings it under the feet. While the hero flies
 * the PK flag a flagged opponent wins the pick, otherwise the nearest living
 * monster does. Kept Phaser-free so it can be unit tested in isolation.
 */

/** Radius (world px) a monster may stand in and still be auto-targeted. */
export const AUTO_TARGET_RANGE = 600;

/** Radius (world px) a PK-flagged peer may stand in and still be auto-targeted. */
export const AUTO_TARGET_PVP_RANGE = 600;

/**
 * A target whose visuals have not been torn down yet. Mocks used in tests may
 * carry no container at all, so a missing container is not a rejection.
 * @param {*} entity
 * @returns {boolean}
 */
function isLive(entity) {
  if (!entity) return false;
  if (typeof entity.x !== "number" || typeof entity.y !== "number") return false;
  if (!Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return false;
  if (entity.isDead || entity.active === false) return false;
  const container = entity.container;
  return container === undefined || container === null || container.active !== false;
}

/**
 * Closest live entity inside `maxRange` that passes `accept`.
 * @param {{x:number,y:number}} origin
 * @param {Array<Object>} entities
 * @param {number} maxRange
 * @param {(entity:Object)=>boolean} accept
 * @returns {Object|null}
 */
function nearestWithin(origin, entities, maxRange, accept) {
  let best = null;
  let bestDistance = Infinity;

  for (const entity of entities || []) {
    if (!isLive(entity) || !accept(entity)) continue;
    const distance = Math.hypot(entity.x - origin.x, entity.y - origin.y);
    if (distance > maxRange || distance >= bestDistance) continue;
    best = entity;
    bestDistance = distance;
  }

  return best;
}

/**
 * Pick the victim the touch controls aim at.
 *
 * Player priority is intentional: a duel is a decision the player already made
 * by raising the PK flag, so a flagged opponent is picked over a closer monster.
 * A peaceful hero never auto-targets peers — the server would refuse every hit.
 *
 * @param {{
 *   player: {x:number,y:number}|null,
 *   enemies?: Array<Object>,
 *   peers?: Array<Object>,
 *   preferPlayers?: boolean,
 *   selfId?: string|null,
 *   monsterRange?: number,
 *   playerRange?: number
 * }} options
 * @returns {{target:Object, kind:"player"|"monster"}|null}
 */
export function pickAutoTarget({
  player,
  enemies = [],
  peers = [],
  preferPlayers = false,
  selfId = null,
  monsterRange = AUTO_TARGET_RANGE,
  playerRange = AUTO_TARGET_PVP_RANGE
} = {}) {
  if (!player || typeof player.x !== "number" || typeof player.y !== "number") return null;
  if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) return null;

  if (preferPlayers) {
    const peer = nearestWithin(
      player,
      peers,
      playerRange,
      (entry) => entry.pkFlag === true && entry.id !== selfId
    );
    if (peer) return { target: peer, kind: "player" };
  }

  const monster = nearestWithin(player, enemies, monsterRange, () => true);
  if (monster) return { target: monster, kind: "monster" };

  return null;
}
