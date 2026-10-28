/**
 * Trung Nguyên Chiến Trường — the central battlefield all three faction cities
 * open onto through their south gate.
 *
 * It is the only map in the world where faction hostility replaces the PK flag:
 * two players from different camps may strike each other without opting in, and
 * two players from the same camp never can. There are no monsters here, so the
 * only thing to fight is the other camps.
 *
 * The three staging camps sit on a triangle around the empty middle: Ngô to the
 * north, Thục to the west, Ngụy to the east. Each one has a gate back to its city.
 *
 * Pure data, no Phaser imports.
 */

/** @type {import("./mapRegistry.js").MapDefinition} */
export const TRUNG_NGUYEN_MAP = {
  id: "trung-nguyen",
  name: "Trung Nguyên Chiến Trường",
  safe: false,
  /** Combat is the point of this map; the city safe-zone rule does not apply. */
  noCombat: false,
  /** Open faction PvP: hostility comes from the camps, not from the PK flag. */
  pvpMode: "faction",

  bounds: { x0: 0, y0: 0, x1: 12000, y1: 12000 },
  /** Neutral centre: nothing spawns on a portal, so arriving here never bounces. */
  spawn: { x: 6000, y: 6000 },

  ground: {
    rim: 0x2b2720,
    fill: 0x4a4036,
    tileKey: "ground-battlefield",
    tileAlpha: 1,
    pad: 380,
    regions: [
      // Packed earth in the middle, trampled by every war.
      { x: 2400, y: 2400, w: 7200, h: 7200, fill: 0x574a3d, alpha: 0.4 },
      // Faction staging grounds, tinted in each camp's colour.
      { x: 4600, y: 600, w: 2800, h: 2400, fill: 0x6b3a34, alpha: 0.22 },
      { x: 700, y: 4600, w: 2600, h: 2800, fill: 0x2f5c46, alpha: 0.22 },
      { x: 8700, y: 4600, w: 2600, h: 2800, fill: 0x354f78, alpha: 0.22 }
    ],
    streets: [
      // Three roads meeting at the middle of the field.
      { x: 5700, y: 1200, w: 600, d: 4400, fill: 0x6f6046, alpha: 0.5 },
      { x: 1800, y: 5700, w: 4400, d: 600, fill: 0x6f6046, alpha: 0.5 },
      { x: 6000, y: 5700, w: 4400, d: 600, fill: 0x6f6046, alpha: 0.5 }
    ]
  },

  buildings: [],

  /** Scenery only: the arena stays open, so nothing blocks a duel. */
  trees: [
    [700, 700, 1.0, "bush-large"],
    [11200, 700, 1.0, "bush-large"],
    [700, 11200, 1.0, "bush-medium"],
    [11200, 11200, 1.0, "bush-medium"],
    [6000, 300, 0.95, "bush-small"],
    [6000, 11600, 0.95, "bush-small"]
  ],

  grass: [
    [2600, 2600, 0.95],
    [9400, 2600, 0.9],
    [2600, 9400, 1.0],
    [9400, 9400, 0.95],
    [6000, 1800, 1.0],
    [6000, 10200, 0.9]
  ],

  gates: [
    { id: "ngo-gate", x: 5400, y: 300, w: 1200, h: 130, orientation: "horizontal", label: "Ngô" },
    { id: "thuc-gate", x: 250, y: 5300, w: 130, h: 1200, orientation: "vertical", label: "Thục" },
    { id: "nguy-gate", x: 11620, y: 5300, w: 130, h: 1200, orientation: "vertical", label: "Ngụy" }
  ],

  /** No friendly NPCs: the field is a war, not a market. */
  npcs: [],

  portals: [
    {
      id: "ngo-gate",
      label: "Kiến Nghiệp",
      rect: { x: 5400, y: 300, w: 1200, h: 500 },
      targetMapId: "market",
      // Market's south portal rect starts at y 9200, so this lands clear of it.
      targetSpawn: { x: 6800, y: 8900 }
    },
    {
      id: "thuc-gate",
      label: "Thành Đô",
      rect: { x: 300, y: 5300, w: 500, h: 1200 },
      targetMapId: "thuc-thanh",
      // Thục's south portal rect starts at y 7600, so this lands clear of it.
      targetSpawn: { x: 4000, y: 7200 }
    },
    {
      id: "nguy-gate",
      label: "Lạc Dương",
      rect: { x: 11200, y: 5300, w: 500, h: 1200 },
      targetMapId: "nguy-thanh",
      targetSpawn: { x: 4000, y: 7200 }
    }
  ],

  zones: [],
  /** A battlefield, not a hunting ground. */
  enemySpawns: []
};
