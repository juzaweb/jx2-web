/**
 * Auto-targeting for the touch layout.
 *
 * The on-screen controls have no cursor to aim with, so the scene picks a
 * victim itself and rings it under the feet. Monsters and duellists share one
 * candidate list and one radius: the nearest body wins, whatever it is. A
 * peaceful hero skips peers entirely — the server refuses hits on them.
 * Kept Phaser-free so it can be unit tested in isolation.
 */

/**
 * Radius (world px) a candidate may stand in and still be auto-targeted. Roughly
 * three ground tiles — far enough to ring a target you can already hit without
 * reaching across the whole map.
 */
export const AUTO_TARGET_RANGE = 1200;

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
 * Pick the victim the touch controls aim at.
 *
 * One list, one radius, nearest wins. Monsters and PK-flagged peers are pooled
 * so a duellist standing between two wolves is picked when (and only when) it is
 * the closest body. `allowPeers` carries the hero's PK flag: a peaceful hero
 * never auto-targets peers, because the server would refuse every hit.
 *
 * @param {{
 *   player: {x:number,y:number}|null,
 *   enemies?: Array<Object>,
 *   peers?: Array<Object>,
 *   allowPeers?: boolean,
 *   selfId?: string|null,
 *   range?: number
 * }} options
 * @returns {{target:Object, kind:"player"|"monster"}|null}
 */
export function pickAutoTarget({
  player,
  enemies = [],
  peers = [],
  allowPeers = false,
  selfId = null,
  range = AUTO_TARGET_RANGE
} = {}) {
  if (!player || typeof player.x !== "number" || typeof player.y !== "number") return null;
  if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) return null;

  let best = null;
  let bestDistance = Infinity;
  const consider = (entity, kind) => {
    if (!isLive(entity)) return;
    const distance = Math.hypot(entity.x - player.x, entity.y - player.y);
    if (distance > range || distance >= bestDistance) return;
    best = { target: entity, kind };
    bestDistance = distance;
  };

  for (const monster of enemies || []) consider(monster, "monster");
  if (allowPeers) {
    for (const peer of peers || []) {
      if (peer?.pkFlag === true && peer.id !== selfId) consider(peer, "player");
    }
  }

  return best;
}
