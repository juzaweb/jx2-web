/**
 * Bắc Lĩnh — the northern hunting ground behind Kiến Nghiệp's north gate.
 *
 * Two species columns per tier, levels 30-44, three camps of fifteen per species
 * (90 spawns). The trail enters from the south edge, so the weakest pack sits
 * closest to the gate and the bears hold the cold heart of the wood.
 *
 * Pure data, no Phaser imports: the same numbers drive the client renderer, the
 * minimap and the server roster.
 */

import { expandCamps } from "./camps.js";

/** Inclusive rectangle helper for the tier zones. */
const zone = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

/**
 * Camps, one species per row band. The y coordinate is the tier: 30s near the
 * southern entrance, 40s at the far north.
 */
const CAMPS = [
  { monsterId: "tuyet-lang", x: 4000, y: 10500, count: 15 },
  { monsterId: "tuyet-lang", x: 11000, y: 11000, count: 15 },

  { monsterId: "son-tac-dau-linh", x: 4000, y: 6500, count: 15 },
  { monsterId: "son-tac-dau-linh", x: 11000, y: 6400, count: 15 },

  { monsterId: "hac-hung", x: 4000, y: 2500, count: 15 },
  { monsterId: "hac-hung", x: 11000, y: 2600, count: 15 }
];

/** @type {import("./mapRegistry.js").MapDefinition} */
export const BAC_LINH_MAP = {
  id: "bac-linh",
  name: "Bắc Lĩnh",
  safe: false,
  /** Hunting ground: PvP stays opt-in through the PK flag. */
  pvpMode: "flag",

  bounds: { x0: 0, y0: 0, x1: 16000, y1: 14000 },
  /** At the southern trail entrance, clear of the return portal rect. */
  spawn: { x: 7600, y: 12800 },

  ground: {
    rim: 0x26302a,
    fill: 0x39453e,
    // Painted in code: the northern wood has no paving either.
    tileKey: "ground-forest",
    tileAlpha: 1,
    pad: 380,
    regions: [
      { x: 260, y: 260, w: 15480, h: 13480, fill: 0x3f4c43, alpha: 0.32 },
      { x: 260, y: 260, w: 15480, h: 4200, fill: 0x2c3731, alpha: 0.4 },
      { x: 260, y: 8580, w: 15480, h: 5160, fill: 0x4a574c, alpha: 0.24 },
      // A clearing follows the trail.
      { x: 260, y: 12580, w: 15480, h: 900, fill: 0x54614f, alpha: 0.26 }
    ],
    streets: [
      {
        x: 7400,
        y: 9000,
        w: 1200,
        d: 4400,
        fill: 0x6f6046,
        alpha: 0.55
      }
    ]
  },

  buildings: [],

  trees: [
    [600, 600, 1.1, "tree-large"],
    [1900, 900, 0.95, "bush-large"],
    [3200, 620, 1.0, "tree-medium"],
    [4700, 900, 1.05, "tree-large"],
    [6300, 600, 0.95, "tree-medium"],
    [9100, 800, 1.0, "tree-large"],
    [10800, 600, 0.92, "bush-medium"],
    [12600, 900, 1.05, "tree-large"],
    [14800, 700, 1.0, "tree-medium"],
    [600, 3400, 0.95, "tree-medium"],
    [2500, 3100, 1.05, "tree-large"],
    [7600, 3000, 0.9, "bush-large"],
    [13500, 3200, 1.0, "tree-large"],
    [15100, 3600, 0.95, "bush-medium"],
    [700, 6200, 1.0, "tree-large"],
    [2600, 6600, 0.95, "bush-medium"],
    [13600, 6500, 1.05, "tree-large"],
    [15100, 6900, 0.9, "bush-small"],
    [600, 9600, 0.95, "tree-medium"],
    [2400, 9900, 1.05, "tree-large"],
    [13500, 10100, 1.0, "tree-large"],
    [15100, 9700, 0.92, "bush-large"],
    [600, 12600, 1.0, "tree-large"],
    [2900, 12900, 0.95, "bush-medium"],
    [12300, 12700, 1.05, "tree-large"],
    [15100, 13000, 0.9, "bush-small"]
  ],

  grass: [
    [1200, 1800, 0.95],
    [3600, 1600, 1.0],
    [5400, 2100, 0.9],
    [8600, 1700, 0.95],
    [11700, 2000, 1.0],
    [14200, 1600, 0.9],
    [1700, 4700, 0.95],
    [5500, 5200, 1.0],
    [9200, 4700, 0.9],
    [12400, 5100, 0.95],
    [3300, 7900, 1.0],
    [7300, 8200, 0.9],
    [10600, 7900, 0.95],
    [14500, 8300, 1.0],
    [2100, 11300, 0.95],
    [5700, 11700, 0.9],
    [9800, 11400, 1.0],
    [13200, 11900, 0.95]
  ],

  gates: [
    {
      id: "bac-linh-gate",
      x: 7400,
      y: 13400,
      w: 1200,
      h: 130,
      orientation: "horizontal",
      label: "Kiến Nghiệp"
    }
  ],

  portals: [
    {
      id: "south-gate",
      label: "Kiến Nghiệp",
      rect: { x: 7600, y: 13400, w: 800, h: 500 },
      targetMapId: "market",
      // Market's north portal rect ends at y 3020, so this lands clear of it.
      targetSpawn: { x: 6800, y: 3200 }
    }
  ],

  npcs: [],

  /** Level bands used by the map validation test and the minimap legend. */
  zones: [
    { id: "tien-doanh", minLevel: 30, maxLevel: 34, bounds: zone(0, 8500, 16000, 14000) },
    { id: "trung-doanh", minLevel: 35, maxLevel: 39, bounds: zone(0, 4500, 16000, 8500) },
    { id: "hau-doanh", minLevel: 40, maxLevel: 44, bounds: zone(0, 0, 16000, 4500) }
  ],

  enemySpawns: expandCamps(CAMPS)
};
