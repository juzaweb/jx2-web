/**
 * Shared world constants used by the client and the Node multiplayer server.
 * Keep this module free of Phaser/React imports so the server can load it
 * directly.
 */

/** Size scale for entities/props. */
export const WORLD_SCALE = 5;
/** Extra spacing scale for the layout (positions only). */
export const WORLD_SPREAD = 2;

/** Layout position scale (spacing) — size scale times the extra spread. */
export const WORLD_POSITION_SCALE = WORLD_SCALE * WORLD_SPREAD;
/** Movement speed multiplier on top of the position scale (game feel knob). */
export const WORLD_SPEED_SCALE = 0.5;
/** World size of one ground tile (the paving grid cell). */
export const WORLD_TILE = 76 * WORLD_SCALE;

/** Hero walk speed in world units per second, before position/speed scaling. */
export const BASE_WALK_SPEED = 175;

/**
 * Protocol-level world bounds. The visible/playable market is smaller and is
 * defined in `marketLayout.js`; the server keeps these generous bounds so old
 * saved positions are still accepted and clamped client-side.
 */
export const WORLD_CONFIG = {
  width: 32000,
  height: 32000
};
