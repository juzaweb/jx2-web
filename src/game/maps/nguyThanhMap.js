/**
 * Lạc Dương — the Ngụy faction's home city.
 *
 * A walled square with the seven city shops and the full newbie-quest NPC
 * roster, four gates connecting to hunting grounds and the central battlefield,
 * and cross-cutting paved avenues. The shop/NPC layout is shared with Thành Đô
 * through `factionCityLayout.js`.
 *
 * Pure data, no Phaser imports.
 */

import { factionCityBuildings, factionCityNpcs } from "../factionCityLayout.js";

/** @type {import("./mapRegistry.js").MapDefinition} */
export const NGUI_THANH_MAP = {
  id: "nguy-thanh",
  name: "Lạc Dương",
  /** City: no monsters spawn here. */
  safe: true,
  /** City safe zone: neither PvE nor PvP is allowed inside the walls. */
  noCombat: true,
  pvpMode: "none",
  homeFaction: "nguy",

  bounds: { x0: 0, y0: 0, x1: 8000, y1: 8000 },
  spawn: { x: 4000, y: 5600 },

  ground: {
    rim: 0x3c4250,
    fill: 0x86827a,
    tileKey: "ground-bricks",
    tileAlpha: 0.94,
    pad: 320,
    regions: [
      { x: 1400, y: 1400, w: 5200, h: 5200, fill: 0x948e84, alpha: 0.55 }
    ],
    streets: [
      {
        x: 0,
        y: 3400,
        w: 8000,
        d: 1200,
        kerb: false,
        tileKey: "ground-walkway",
        tint: 0xb0a288,
        tileScale: 0.55
      },
      {
        x: 3400,
        y: 0,
        w: 1200,
        d: 8000,
        kerb: false,
        tileKey: "ground-walkway",
        tint: 0xb0a288,
        tileScale: 0.55
      }
    ]
  },

  buildings: factionCityBuildings("nguy"),

  trees: [
    [900, 900, 1.05, "tree-large"],
    [2200, 700, 0.95, "bush-medium"],
    [5700, 800, 1.0, "tree-medium"],
    [7100, 1000, 1.05, "tree-large"],
    [700, 2700, 0.95, "bush-large"],
    [7300, 1900, 1.0, "tree-medium"],
    [800, 6900, 1.05, "tree-large"],
    [2300, 7200, 0.95, "bush-medium"],
    [5700, 7200, 1.0, "tree-medium"],
    [7200, 6900, 0.95, "bush-large"]
  ],

  grass: [
    [1500, 1800, 0.95],
    [6500, 1800, 1.0],
    [1200, 4800, 0.9],
    [6800, 4800, 0.95],
    [3100, 6600, 1.0],
    [6400, 6500, 0.9]
  ],

  npcs: factionCityNpcs("nguy"),

  gates: [
    { id: "nguy-north-gate", x: 3400, y: 0, w: 1200, h: 130, orientation: "horizontal", label: "Bắc Môn" },
    { id: "nguy-south-gate", x: 3400, y: 7870, w: 1200, h: 130, orientation: "horizontal", label: "Nam Môn" },
    { id: "nguy-west-gate", x: 0, y: 3400, w: 130, h: 1200, orientation: "vertical", label: "Tây Môn" },
    { id: "nguy-east-gate", x: 7870, y: 3400, w: 130, h: 1200, orientation: "vertical", label: "Đông Môn" }
  ],

  portals: [
    {
      id: "south-gate",
      label: "Trung Nguyên Chiến Trường",
      rect: { x: 3400, y: 7600, w: 1200, h: 400 },
      targetMapId: "trung-nguyen",
      targetSpawn: { x: 10400, y: 6000 }
    },
    {
      id: "north-gate",
      label: "Nghiệp Quan",
      rect: { x: 3400, y: 0, w: 1200, h: 400 },
      targetMapId: "nghiep-quan",
      targetSpawn: { x: 7600, y: 12800 }
    },
    {
      id: "east-gate",
      label: "Hứa Điền",
      rect: { x: 7600, y: 3400, w: 400, h: 1200 },
      targetMapId: "hua-dien",
      targetSpawn: { x: 1400, y: 7000 }
    },
    {
      id: "west-gate",
      label: "Quan Trung",
      rect: { x: 0, y: 3400, w: 400, h: 1200 },
      targetMapId: "quan-trung",
      targetSpawn: { x: 14600, y: 7000 }
    }
  ],

  zones: [],
  enemySpawns: []
};
