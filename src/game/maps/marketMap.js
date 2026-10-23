/**
 * Biện Kinh market square expressed as a MapDefinition.
 *
 * The layout numbers still live in `marketLayout.js` (kept Phaser-free and shared
 * with the server); this module only packages them into the shape the generic
 * world renderer, the minimap and the map registry expect.
 */

import {
  MARKET_BOUNDS,
  MARKET_BUILDINGS,
  MARKET_GRASS,
  MARKET_MEDALLIONS,
  MARKET_NPCS,
  MARKET_SPAWN,
  MARKET_TREES,
  MARKET_WALKWAY
} from "../marketLayout.js";

/**
 * Legacy server roster, in its historical order so enemy ids stay 0..7. Three of
 * these lie east of the brick square: the roster predates the current camera
 * bounds and the tests pin their coordinates, so they are kept as-is.
 * @type {Array<[number, number]>}
 */
const LEGACY_ENEMY_SPAWNS = [
  [8400, 6000],
  [9500, 6700],
  [11100, 5900],
  [12600, 6500],
  [13800, 5900],
  [7600, 8000],
  [10500, 8200],
  [13200, 7900]
];

/** @type {import("./mapRegistry.js").MapDefinition} */
export const MARKET_MAP = {
  id: "market",
  name: "Biện Kinh",
  /** Peaceful-looking square, but the legacy wolf roster still roams it. */
  safe: false,
  /**
   * Three legacy spawn points sit outside `bounds`. Rather than move them (and
   * break the pinned server tests) the registry skips the bounds check for this
   * map. New maps must keep every spawn inside their bounds.
   */
  allowOutOfBoundsSpawns: true,

  bounds: { ...MARKET_BOUNDS },
  spawn: { x: MARKET_SPAWN.x, y: MARKET_SPAWN.y },

  ground: {
    rim: 0x53603f,
    fill: 0x8a8272,
    tileKey: "ground-bricks",
    tileAlpha: 0.94,
    pad: 320,
    streets: [
      {
        ...MARKET_WALKWAY,
        rotation: -0.13,
        kerb: true,
        tileKey: "ground-walkway",
        tint: 0xb0a288,
        tileScale: 0.55
      }
    ],
    medallions: MARKET_MEDALLIONS
  },

  buildings: MARKET_BUILDINGS,
  trees: MARKET_TREES,
  grass: MARKET_GRASS,
  npcs: MARKET_NPCS,

  gates: [
    {
      id: "market-east-gate",
      x: 10870,
      y: 4900,
      w: 130,
      h: 1200,
      orientation: "vertical",
      label: "Đông Môn"
    }
  ],

  portals: [
    {
      id: "east-gate",
      label: "Đông Môn Thành",
      rect: { x: 10480, y: 4900, w: 520, h: 1200 },
      targetMapId: "dong-mon-thanh",
      targetSpawn: { x: 1200, y: 3920 }
    }
  ],

  enemySpawns: LEGACY_ENEMY_SPAWNS.map(([x, y], index) => ({
    id: index,
    monsterId: "soi-xam",
    x,
    y
  })),

  zones: []
};
