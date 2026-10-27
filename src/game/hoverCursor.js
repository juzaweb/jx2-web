/**
 * Pointer feedback for attackable targets.
 *
 * Hovering a living monster or a PK-flagged peer swaps the canvas cursor to a
 * drawn saber, so the player can tell that a left click would start a fight
 * instead of walking. The hit tests reuse the click rules in `enemy.js` and
 * `pvpTargeting.js`, keeping the cursor and the click in agreement.
 *
 * Kept free of Phaser/React imports so it can be unit tested in isolation.
 */

import { findEnemyAt } from "./enemy.js";
import { findPlayerAt } from "./pvpTargeting.js";
import { isHostileFaction } from "./factions.js";

/** Normal arrow cursor of the game viewport. */
export const DEFAULT_CURSOR = "default";

/**
 * Saber cursor, built from `scripts/build_dao_cursor.py`. The hotspot is the
 * blade tip (3, 3) so the aimed pixel is the point of the blade, and `crosshair`
 * is the last fallback if the image cannot be loaded.
 */
export const ATTACK_CURSOR = 'url("/cursors/dao-attack.png") 3 3, crosshair';

/**
 * Whether a left click on this ground-space point would start a fight: a living
 * monster, or the peer whose drawn body is under the pointer when that peer
 * carries the PK flag.
 *
 * The peer is resolved through `findPlayerAt` (nearest drawn body) before the
 * flag test, because that is the body `pointerdown` picks: a peaceful body
 * standing in front of a flagged one makes the click walk, so the cursor must
 * not promise an attack either.
 *
 * @param {Array<object>} enemies living monsters
 * @param {Array<object>} players remote peers
 * @param {number} x ground-space x
 * @param {number} y ground-space y
 * @param {{"none"|"flag"|"faction"}} [options] current map PvP policy
 * @returns {boolean}
 */
export function isAttackableAt(enemies, players, x, y, { pvpMode = "flag", localFaction = null } = {}) {
  if (findEnemyAt(enemies, x, y)) return true;

  const player = findPlayerAt(players, x, y);
  if (!player) return false;
  if (pvpMode === "none") return false;
  if (pvpMode === "faction") return isHostileFaction(localFaction, player.faction);
  return player.pkFlag === true;
}

/**
 * CSS cursor value for a ground-space point.
 * @param {Array<object>} enemies
 * @param {Array<object>} players
 * @param {number} x
 * @param {number} y
 * @param {{"none"|"flag"|"faction"}} [options]
 * @returns {string}
 */
export function cursorForGroundPoint(enemies, players, x, y, options) {
  return isAttackableAt(enemies, players, x, y, options) ? ATTACK_CURSOR : DEFAULT_CURSOR;
}

/**
 * Apply a cursor to an element, skipping the write when it already matches so a
 * stream of `pointermove` events does not dirty the style every frame.
 * @param {{style?:{cursor?:string}}|null|undefined} element
 * @param {string} cursor
 */
export function applyCursor(element, cursor) {
  const style = element?.style;
  if (!style) return;
  if (style.cursor !== cursor) style.cursor = cursor;
}
