/**
 * The three political camps of the world, shared by the Phaser client and the
 * Node server.
 *
 * A faction is a city, not a martial sect: the removed `sect` system decided a
 * skill kit, while a faction only decides which city the hero calls home and
 * which players are hostile on a faction battlefield. Keep this module free of
 * Phaser imports so `server/src/` can load it directly.
 */

/**
 * @typedef {object} FactionDefinition
 * @property {string} id wire id, stored on the character row
 * @property {string} name Vietnamese display name
 * @property {string} glyph Han character shown on the character-select tile
 * @property {string} color nameplate colour on a faction battlefield
 * @property {string} homeMapId city map that is that faction's home
 * @property {string} cityName city display name
 */

/** @type {Readonly<Record<string, FactionDefinition>>} */
export const FACTIONS = Object.freeze({
  han: Object.freeze({
    id: "han",
    name: "Hán",
    glyph: "漢",
    color: "#d9534f",
    homeMapId: "market",
    cityName: "Biện Kinh"
  }),
  thuc: Object.freeze({
    id: "thuc",
    name: "Thục",
    glyph: "蜀",
    color: "#3aa76d",
    homeMapId: "thuc-thanh",
    cityName: "Thục Thành"
  }),
  nguy: Object.freeze({
    id: "nguy",
    name: "Ngụy",
    glyph: "魏",
    color: "#4a7bd1",
    homeMapId: "nguy-thanh",
    cityName: "Ngụy Thành"
  })
});

/** Every faction id, in catalog order. */
export const FACTION_IDS = Object.keys(FACTIONS);

/** Faction a character falls back to (every pre-faction save). */
export const DEFAULT_FACTION = "han";

/**
 * Normalise an unknown faction id to a real one.
 * @param {*} id
 * @returns {string}
 */
export function normalizeFaction(id) {
  return FACTION_IDS.includes(id) ? id : DEFAULT_FACTION;
}

/**
 * @param {*} id
 * @returns {boolean}
 */
export function isFactionId(id) {
  return FACTION_IDS.includes(id);
}

/**
 * Resolve a faction definition, falling back to the default camp.
 * @param {*} id
 * @returns {FactionDefinition}
 */
export function getFaction(id) {
  return FACTIONS[normalizeFaction(id)];
}

/**
 * The city map a faction respawns in and boots into.
 * @param {*} id
 * @returns {string}
 */
export function factionHomeMap(id) {
  return getFaction(id).homeMapId;
}

/**
 * Whether two players from these factions may fight on a faction battlefield.
 * Unknown ids never fight: a stale client must not turn into free hostility.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function isHostileFaction(a, b) {
  return isFactionId(a) && isFactionId(b) && a !== b;
}
