/**
 * Map registry — the single source of truth for every playable map.
 *
 * Shape of a MapDefinition (documented here instead of a types-only module):
 *
 * ```text
 * id            unique string, used in saves and on the wire
 * name          Vietnamese display name
 * safe          true = no monsters spawn when offline
 * noCombat      true = a city safe zone: no PvE or PvP allowed there, whatever
 *               the PK flag says (see isCombatAllowed)
 * bounds        {x0, y0, x1, y1} walkable rectangle; camera + physics clamp to it
 * spawn         {x, y} default / respawn point
 * ground        {rim, fill, tileKey, tileAlpha, pad, regions?, streets?, medallions?}
 * buildings     shop footprints ({id, palette, x, y, w, d, scale, ...})
 * trees/grass   [x, y, scale, kind] prop lists
 * gates         [{id, x, y, w, h, orientation, label}] decorative arches
 * portals       [{id, label, rect:{x,y,w,h}, targetMapId, targetSpawn}]
 * enemySpawns   [{id, monsterId, x, y}] ids are unique per map
 * zones         [{id, minLevel, maxLevel, bounds:{x0,y0,x1,y1}}] level bands
 * npcs          friendly NPC definitions (market only today)
 * ```
 *
 * Keep this module Phaser-free: `server/src/websocket/gameSocket.js` imports it
 * directly to build its per-map rosters.
 */

import { WORLD_CONFIG } from "../worldConfig.js";
import { DONG_MON_THANH_MAP } from "./dongMonThanhMap.js";
import { MARKET_MAP } from "./marketMap.js";

/**
 * @typedef {object} MapDefinition
 * @property {string} id
 * @property {string} name
 * @property {boolean} safe
 * @property {boolean} [noCombat]
 * @property {{x0:number, y0:number, x1:number, y1:number}} bounds
 * @property {{x:number, y:number}} spawn
 * @property {object} ground
 * @property {Array<object>} buildings
 * @property {Array<Array<number|string>>} trees
 * @property {Array<Array<number>>} grass
 * @property {Array<object>} gates
 * @property {Array<object>} portals
 * @property {Array<{id:number, monsterId:string, x:number, y:number}>} enemySpawns
 * @property {Array<object>} zones
 * @property {Array<object>} npcs
 * @property {boolean} [allowOutOfBoundsSpawns]
 */

/** Map the hero boots into when nothing else is known. */
export const DEFAULT_MAP_ID = "market";

/** @type {Record<string, import("./mapRegistry.js").MapDefinition>} */
export const MAPS = Object.freeze({
  market: MARKET_MAP,
  "dong-mon-thanh": DONG_MON_THANH_MAP
});

/** Map ids in registry order (useful for validation and docs). */
export const MAP_IDS = Object.keys(MAPS);

/**
 * @param {string} [id]
 * @returns {boolean}
 */
export function isKnownMap(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(MAPS, id);
}

/**
 * Resolve a map definition, falling back to the default map.
 * @param {string} [id]
 * @returns {import("./mapRegistry.js").MapDefinition}
 */
export function getMap(id) {
  return isKnownMap(id) ? MAPS[id] : MAPS[DEFAULT_MAP_ID];
}

/**
 * Walkable size of a map.
 * @param {import("./mapRegistry.js").MapDefinition|string} [map]
 * @returns {{width:number, height:number}}
 */
export function mapSize(map) {
  const def = typeof map === "string" ? getMap(map) : map || getMap();
  return { width: def.bounds.x1 - def.bounds.x0, height: def.bounds.y1 - def.bounds.y0 };
}

/**
 * Whether fighting is allowed on a map. A map flagged `noCombat` is a city safe
 * zone: neither monsters nor other players can be struck there, even with the PK
 * flag raised. The client uses this to refuse swings/casts; the server uses it to
 * refuse `enemy_hit` / `player_hit`, so a forged packet cannot fight in town.
 *
 * A missing definition is treated as combat-allowed so callers that have not
 * loaded a map yet (boot, tests) keep working.
 * @param {import("./mapRegistry.js").MapDefinition|string|null} [map]
 * @returns {boolean}
 */
export function isCombatAllowed(map) {
  const def = typeof map === "string" ? getMap(map) : map;
  return def?.noCombat !== true;
}

/**
 * True when a ground point lies inside the map's walkable rectangle.
 * @param {import("./mapRegistry.js").MapDefinition|string} map
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInsideMap(map, x, y) {
  const def = typeof map === "string" ? getMap(map) : map || getMap();
  const b = def.bounds;
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

/**
 * Descriptor consumed by the minimap and the full-city modal. Carries the active
 * map's landmarks so the canvas never needs to import a specific layout.
 * @param {import("./mapRegistry.js").MapDefinition|string} [map]
 */
export function mapWorldConfig(map) {
  const def = typeof map === "string" ? getMap(map) : map || getMap();
  const { width, height } = mapSize(def);
  return {
    ...WORLD_CONFIG,
    id: def.id,
    name: def.name,
    width,
    height,
    cityBounds: def.bounds,
    buildings: def.buildings,
    trees: def.trees,
    gates: def.gates,
    portals: def.portals
  };
}

/**
 * The portal definition with this id on the given map, or null when the map has
 * no such portal. Used by the server to validate a `map_change` before it trusts
 * the destination the client claims.
 * @param {string} mapId
 * @param {string} portalId
 * @returns {?import("./portals.js").PortalDefinition}
 */
export function findPortal(mapId, portalId) {
  const map = getMap(mapId);
  return (map.portals || []).find((portal) => portal.id === portalId) || null;
}
