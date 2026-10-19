/**
 * Pure world layout constants shared by the Phaser scene, the React map UI and
 * the Node multiplayer server. Keep this module free of Phaser/React imports so
 * the server can load it directly.
 */

/** Ground rectangle enclosed by the Biện Kinh city walls (2x the original plaza). */
export const CITY_BOUNDS = { x0: 90, y0: 60, x1: 4130, y1: 2320 };

export const WORLD_CONFIG = {
  width: 8800,
  height: 5000,
  cityBounds: CITY_BOUNDS
};

/**
 * Building footprints on the ground plane. Both the 3D scene and the minimap
 * read from here, so a layout change never leaves the map out of date.
 */
export const CITY_BUILDINGS = [
  { id: "apothecary", x: 140, y: 30, w: 380, d: 210 },
  { id: "bank", x: 1460, y: 200, w: 380, d: 250 },
  { id: "tavern", x: 70, y: 900, w: 340, d: 230 },
  { id: "academy", x: 1580, y: 720, w: 360, d: 240 },
  { id: "pavilion", x: 1080, y: 360, w: 170, d: 140 },
  { id: "dragon", x: 1060, y: 860, w: 170, d: 120 }
];

/** Main paved avenues crossing the city. */
export const CITY_AVENUES = {
  horizontal: { y: 575, height: 90 },
  vertical: { x: 955, width: 90 }
};
