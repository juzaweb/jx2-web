/**
 * Tây Sơn — the western hunting ground behind Biện Kinh's west gate.
 *
 * Same shape as Bắc Lĩnh but a higher tier: levels 45-60, three camps of fifteen
 * per species (90 spawns). The trail enters from the west edge, so the golden
 * guards hold the near clearings and the western swordsmen the far ridge.
 *
 * Pure data, no Phaser imports.
 */

import { expandCamps } from "./camps.js";

/** Inclusive rectangle helper for the tier zones. */
const zone = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

const CAMPS = [
  { monsterId: "kim-giap-binh", x: 4000, y: 10500, count: 15 },
  { monsterId: "kim-giap-binh", x: 11000, y: 11000, count: 15 },

  { monsterId: "huyet-ma", x: 4000, y: 6500, count: 15 },
  { monsterId: "huyet-ma", x: 11000, y: 6400, count: 15 },

  { monsterId: "tay-vuc-kiem-khach", x: 4000, y: 2500, count: 15 },
  { monsterId: "tay-vuc-kiem-khach", x: 11000, y: 2600, count: 15 }
];

/** @type {import("./mapRegistry.js").MapDefinition} */
export const TAY_SON_MAP = {
  id: "tay-son",
  name: "Tây Sơn",
  safe: false,
  /** Hunting ground: PvP stays opt-in through the PK flag. */
  pvpMode: "flag",

  bounds: { x0: 0, y0: 0, x1: 16000, y1: 14000 },
  /** At the western trail entrance, clear of the return portal rect. */
  spawn: { x: 1600, y: 7000 },

  ground: {
    rim: 0x352a24,
    fill: 0x4a3c32,
    tileKey: "ground-forest",
    tileAlpha: 1,
    pad: 380,
    regions: [
      { x: 260, y: 260, w: 15480, h: 13480, fill: 0x54453a, alpha: 0.3 },
      { x: 260, y: 260, w: 15480, h: 4200, fill: 0x3a2e26, alpha: 0.4 },
      { x: 260, y: 8580, w: 15480, h: 5160, fill: 0x5c4b3e, alpha: 0.22 },
      // A clearing follows the trail.
      { x: 260, y: 6560, w: 9400, h: 900, fill: 0x665343, alpha: 0.28 }
    ],
    streets: [
      {
        x: 260,
        y: 6800,
        w: 9800,
        d: 420,
        fill: 0x7a6449,
        alpha: 0.6
      }
    ]
  },

  buildings: [],

  trees: [
    [700, 600, 1.05, "tree-large"],
    [2400, 900, 0.95, "bush-large"],
    [4200, 600, 1.0, "tree-medium"],
    [6500, 900, 1.05, "tree-large"],
    [9000, 600, 0.95, "tree-medium"],
    [11600, 800, 1.0, "tree-large"],
    [14200, 600, 0.92, "bush-medium"],
    [15300, 1000, 1.05, "tree-large"],
    [700, 3200, 0.95, "tree-medium"],
    [3000, 3100, 1.05, "tree-large"],
    [7600, 3000, 0.9, "bush-large"],
    [12800, 3200, 1.0, "tree-large"],
    [15100, 3600, 0.95, "bush-medium"],
    [700, 6200, 1.0, "tree-large"],
    [2600, 6600, 0.95, "bush-medium"],
    [12400, 6500, 1.05, "tree-large"],
    [15100, 6900, 0.9, "bush-small"],
    [700, 9600, 0.95, "tree-medium"],
    [2400, 9900, 1.05, "tree-large"],
    [13500, 10100, 1.0, "tree-large"],
    [15100, 9700, 0.92, "bush-large"],
    [700, 12600, 1.0, "tree-large"],
    [2900, 12900, 0.95, "bush-medium"],
    [12300, 12700, 1.05, "tree-large"],
    [15100, 13000, 0.9, "bush-small"]
  ],

  grass: [
    [1900, 2000, 0.95],
    [4600, 1700, 1.0],
    [7600, 2100, 0.9],
    [10600, 1700, 0.95],
    [13400, 2000, 1.0],
    [14800, 1600, 0.9],
    [2100, 4700, 0.95],
    [6300, 5200, 1.0],
    [9700, 4700, 0.9],
    [13000, 5100, 0.95],
    [3400, 7900, 1.0],
    [7400, 8200, 0.9],
    [10700, 7900, 0.95],
    [14100, 8300, 1.0],
    [2100, 11300, 0.95],
    [5700, 11700, 0.9],
    [9800, 11400, 1.0],
    [13200, 11900, 0.95]
  ],

  gates: [
    {
      id: "tay-son-gate",
      x: 120,
      y: 6650,
      w: 130,
      h: 700,
      orientation: "vertical",
      label: "Biện Kinh"
    }
  ],

  portals: [
    {
      id: "west-gate",
      label: "Biện Kinh",
      rect: { x: 120, y: 6650, w: 420, h: 700 },
      targetMapId: "market",
      // Market's west portal rect ends at x 2520, so this lands clear of it.
      targetSpawn: { x: 2600, y: 5500 }
    }
  ],

  npcs: [],

  /** Level bands used by the map validation test and the minimap legend. */
  zones: [
    { id: "tien-doanh", minLevel: 45, maxLevel: 49, bounds: zone(0, 8500, 16000, 14000) },
    { id: "trung-doanh", minLevel: 50, maxLevel: 54, bounds: zone(0, 4500, 16000, 8500) },
    { id: "hau-doanh", minLevel: 55, maxLevel: 60, bounds: zone(0, 0, 16000, 4500) }
  ],

  enemySpawns: expandCamps(CAMPS)
};
