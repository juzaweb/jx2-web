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
   * Biện Kinh is the home city, so it is a safe zone: no monster or player can be
   * struck there, even with the PK flag raised. The old wolf roster above only
   * exists for harnesses, which opt out of the ban explicitly.
   */
  noCombat: true,
  /** A city is not a battlefield: faction hostility is decided elsewhere. */
  pvpMode: "none",
  /** Biện Kinh is the Hán faction's capital. */
  homeFaction: "han",
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
    },
    {
      id: "market-west-gate",
      x: 2100,
      y: 4900,
      w: 130,
      h: 1200,
      orientation: "vertical",
      label: "Tây Môn"
    },
    {
      id: "market-north-gate",
      x: 6200,
      y: 2600,
      w: 1200,
      h: 130,
      orientation: "horizontal",
      label: "Bắc Môn"
    },
    {
      id: "market-south-gate",
      x: 6200,
      y: 9470,
      w: 1200,
      h: 130,
      orientation: "horizontal",
      label: "Nam Môn"
    }
  ],

  /**
   * Four gates, one destination each. The south gate is the only road to the
   * central battlefield; the other three are hunting grounds.
   */
  portals: [
    {
      id: "east-gate",
      label: "Đông Môn Thành",
      rect: { x: 10480, y: 4900, w: 520, h: 1200 },
      targetMapId: "dong-mon-thanh",
      targetSpawn: { x: 1200, y: 7000 }
    },
    {
      id: "west-gate",
      label: "Tây Sơn",
      rect: { x: 2100, y: 4900, w: 420, h: 1200 },
      targetMapId: "tay-son",
      targetSpawn: { x: 1600, y: 7000 }
    },
    {
      id: "north-gate",
      label: "Bắc Lĩnh",
      rect: { x: 6200, y: 2600, w: 1200, h: 420 },
      targetMapId: "bac-linh",
      targetSpawn: { x: 7600, y: 12800 }
    },
    {
      id: "south-gate",
      label: "Trung Nguyên Chiến Trường",
      rect: { x: 6200, y: 9200, w: 1200, h: 400 },
      targetMapId: "trung-nguyen",
      targetSpawn: { x: 6000, y: 1600 }
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
