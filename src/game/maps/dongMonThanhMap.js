/**
 * Đông Môn Thành — 24 000 × 14 000 of forest east of Biện Kinh.
 *
 * The hero steps off the realm road into open woodland. Six hunting columns march
 * east, getting deadlier as you walk in: Sơn Cẩu (Lv3) → Dã Lang (8) → Lâm Tặc
 * (14) → Hắc Y Sát Thủ (19) → Thiết Giáp Binh (24) → Ma Giáo Đệ Tử (29). Each
 * column holds three camps of fifteen monsters, so a species never shares a
 * clearing with another and the level never goes backwards on the way in.
 *
 * No walls, no paving, no shops and no boss — the floor is painted forest and the
 * only man-made mark is the dirt trail through it.
 *
 * Pure data, no Phaser imports: the same numbers drive the client renderer, the
 * minimap and the server roster.
 */

import { expandCamps } from "./camps.js";

/** Inclusive rectangle helper for the tier zones. */
const zone = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

/**
 * Hunting camps: one species at one level, `count` monsters scattered inside a
 * single clearing. `expandCamps` turns this table into the flat spawn list the
 * renderer, the registry and the server consume, so retuning a pack is one line
 * here instead of fifteen entries below.
 */
const CAMPS = [
  // One species per COLUMN, and the columns march east from the entrance in
  // level order: Sơn Cẩu (3) → Dã Lang (8) → Lâm Tặc (14) → Hắc Y (19) →
  // Thiết Giáp (24) → Ma Giáo (29). Columns are far enough apart that two
  // species never share a clearing; rows can sit wherever the ground allows.

  // Near trees (levels 3-8).
  { monsterId: "son-ca", x: 3000, y: 2400, count: 15 },
  { monsterId: "son-ca", x: 3000, y: 4800, count: 15 },
  { monsterId: "son-ca", x: 3000, y: 11200, count: 15 },
  { monsterId: "da-lang", x: 6300, y: 2600, count: 15 },
  { monsterId: "da-lang", x: 6300, y: 6400, count: 15 },
  { monsterId: "da-lang", x: 6300, y: 11200, count: 15 },

  // Middle wood (levels 14-19).
  { monsterId: "lam-tac", x: 10000, y: 2600, count: 15 },
  { monsterId: "lam-tac", x: 10000, y: 6400, count: 15 },
  { monsterId: "lam-tac", x: 10000, y: 11200, count: 15 },
  { monsterId: "hac-y-sat-thu", x: 13800, y: 2600, count: 15 },
  { monsterId: "hac-y-sat-thu", x: 13800, y: 6400, count: 15 },
  { monsterId: "hac-y-sat-thu", x: 13800, y: 11200, count: 15 },

  // Black heart of the forest (levels 24-29).
  { monsterId: "thiet-giap-binh", x: 18000, y: 2600, count: 15 },
  { monsterId: "thiet-giap-binh", x: 18000, y: 6400, count: 15 },
  { monsterId: "thiet-giap-binh", x: 18000, y: 11200, count: 15 },
  { monsterId: "ma-giao-de-tu", x: 21500, y: 2600, count: 15 },
  { monsterId: "ma-giao-de-tu", x: 21500, y: 6400, count: 15 },
  { monsterId: "ma-giao-de-tu", x: 21500, y: 11200, count: 15 }
];

/** @type {import("./mapRegistry.js").MapDefinition} */
export const DONG_MON_THANH_MAP = {
  id: "dong-mon-thanh",
  name: "Đông Môn Thành",
  safe: false,
  /** Hunting ground: PvP stays opt-in through the PK flag. */
  pvpMode: "flag",

  bounds: { x0: 0, y0: 0, x1: 24000, y1: 14000 },
  /** At the forest entrance, clear of the return portal rect. */
  spawn: { x: 1200, y: 7000 },

  ground: {
    rim: 0x2b3524,
    fill: 0x3b4830,
    // Painted in code (WorldManager.ensureGroundTexture): this map has no paving.
    tileKey: "ground-forest",
    tileAlpha: 1,
    pad: 380,
    regions: [
      // Lighter ground near the entrance, deep shade to the east where the
      // stronger monsters live.
      { x: 260, y: 260, w: 23480, h: 13480, fill: 0x44523a, alpha: 0.35 },
      { x: 15800, y: 260, w: 7940, h: 13480, fill: 0x2c3724, alpha: 0.42 },
      // A clearing follows the trail.
      { x: 260, y: 6560, w: 23480, h: 1000, fill: 0x4f5d3d, alpha: 0.3 },
      // Canopy shadows.
      { x: 380, y: 380, w: 3800, h: 3400, fill: 0x2f3a28, alpha: 0.33 },
      { x: 2600, y: 8600, w: 4400, h: 4800, fill: 0x2f3a28, alpha: 0.3 }
    ],
    streets: [
      {
        // One trodden trail through the whole wood: painted earth, no kerb, no
        // paving texture.
        x: 260,
        y: 6800,
        w: 23060,
        d: 400,
        fill: 0x6f6046,
        alpha: 0.7
      }
    ]
  },

  // A hunting ground, not a market: Đông Môn Thành has no shops, no NPCs and no
  // roofs at all. Buying and selling stays in Biện Kinh.
  buildings: [],

  /** Dense woodland in the outskirts; a handful of shade trees inside the walls. */
  trees: [
    // Forest belt (west of the city wall), kept clear of the dirt trail.
    [420, 700, 1.1, "tree-large"],
    [900, 1250, 0.95, "bush-large"],
    [1500, 520, 1.0, "tree-medium"],
    [2350, 620, 1.05, "tree-large"],
    [2900, 600, 0.95, "tree-medium"],
    [560, 2050, 1.0, "tree-large"],
    [2600, 2050, 1.1, "tree-large"],
    [1650, 2300, 0.9, "bush-medium"],
    [3180, 2450, 0.95, "tree-medium"],
    [460, 3000, 0.9, "bush-medium"],
    [2750, 3050, 0.95, "bush-large"],
    [620, 4250, 1.05, "tree-large"],
    [1750, 4500, 0.95, "tree-medium"],
    [2850, 4400, 1.0, "tree-large"],
    [980, 5000, 0.9, "bush-small"],
    [2500, 5100, 0.95, "bush-large"],
    [3000, 5650, 1.0, "tree-medium"],
    [1450, 5850, 1.05, "tree-large"],
    [520, 6150, 0.95, "tree-medium"],
    [2050, 6400, 0.9, "bush-medium"],
    [3080, 6200, 0.95, "bush-small"],

    // Inside the walls: the courtyards are overgrown, not built up.
    [3650, 1300, 0.95, "tree-medium"],
    [6700, 1300, 0.9, "bush-large"],
    [3650, 6100, 1.0, "tree-large"],
    [6700, 6100, 0.9, "bush-medium"],
    [8500, 1100, 0.95, "tree-medium"],
    [8500, 6100, 1.0, "tree-large"],
    [6950, 2050, 0.9, "bush-small"],
    [6950, 4950, 0.9, "bush-small"],
    [3600, 2900, 0.9, "bush-medium"],
    [5900, 2900, 0.95, "tree-medium"],
    [3600, 4300, 0.95, "tree-medium"],
    [5900, 4300, 0.9, "bush-large"],
    [4700, 2700, 1.0, "tree-large"],
    [4700, 4500, 0.95, "bush-medium"],
    [5050, 2500, 0.9, "bush-small"],
    [5050, 4700, 0.95, "tree-medium"],

    // Deeper wood (east half).
    [6300, 700, 1.0, "tree-large"],
    [7200, 1500, 0.95, "bush-large"],
    [8050, 900, 1.05, "tree-large"],
    [8600, 1800, 0.95, "tree-medium"],
    [7000, 3100, 0.9, "bush-medium"],
    [8500, 2500, 1.0, "tree-large"],
    [6600, 4200, 0.95, "tree-medium"],
    [7500, 4500, 1.05, "tree-large"],
    [8600, 5300, 0.95, "bush-large"],
    [6900, 6000, 1.0, "tree-large"],
    [7900, 6300, 0.9, "bush-medium"],

    // Eastern half of the widened wood (levels 21-29).
    [9200, 900, 1.0, "tree-large"],
    [10100, 1700, 0.95, "tree-medium"],
    [9400, 2900, 1.05, "tree-large"],
    [10600, 2500, 0.9, "bush-large"],
    [9700, 4700, 1.0, "tree-large"],
    [10900, 4300, 0.95, "bush-medium"],
    [9400, 6400, 0.95, "tree-medium"],
    [10700, 7100, 1.0, "tree-large"],
    [10100, 8300, 0.9, "bush-large"],
    [11500, 700, 1.05, "tree-large"],
    [12500, 1400, 0.95, "tree-medium"],
    [13600, 800, 1.0, "tree-large"],
    [14500, 1500, 0.9, "bush-large"],
    [11300, 2300, 0.95, "tree-medium"],
    [12400, 2700, 1.0, "tree-large"],
    [13700, 2400, 0.9, "bush-medium"],
    [14400, 3100, 0.95, "tree-medium"],
    [11700, 4400, 1.05, "tree-large"],
    [12900, 4700, 0.95, "tree-medium"],
    [14100, 4300, 0.9, "bush-large"],
    [11200, 6200, 1.0, "tree-large"],
    [12400, 6500, 0.9, "bush-medium"],
    [13800, 6100, 1.05, "tree-large"],
    [11600, 7800, 0.95, "tree-medium"],
    [12900, 8300, 1.0, "tree-large"],
    [14300, 7700, 0.9, "bush-large"],

    // The far east and the southern wood (widened 24 000 x 14 000 map).
    [15400, 1130, 1.03, "tree-large"],
    [17350, 1050, 0.98, "bush-small"],
    [19140, 1120, 0.99, "tree-medium"],
    [20810, 1080, 0.92, "bush-small"],
    [22500, 1180, 0.96, "tree-medium"],
    [15720, 2100, 0.95, "bush-medium"],
    [17220, 2100, 1.05, "tree-large"],
    [18940, 2210, 1.03, "bush-medium"],
    [20730, 2300, 1.02, "tree-large"],
    [22580, 2210, 1.04, "tree-medium"],
    [15650, 3460, 0.99, "bush-medium"],
    [17460, 3400, 0.91, "tree-medium"],
    [19140, 3290, 0.97, "bush-medium"],
    [21030, 3500, 0.94, "bush-large"],
    [22650, 3350, 1.02, "bush-small"],
    [15570, 4650, 0.97, "bush-large"],
    [17280, 4500, 1.01, "bush-large"],
    [18950, 4430, 1.01, "bush-small"],
    [20800, 4670, 0.94, "tree-medium"],
    [22630, 4720, 0.97, "tree-large"],
    [15530, 5640, 0.95, "bush-small"],
    [17110, 5630, 1.07, "bush-small"],
    [19050, 5940, 1.05, "bush-small"],
    [20780, 5950, 1.08, "tree-large"],
    [22420, 5860, 0.95, "bush-large"],
    [15480, 7010, 0.94, "bush-large"],
    [17280, 6830, 0.98, "tree-large"],
    [19000, 6800, 1.06, "bush-large"],
    [20830, 6980, 1.09, "tree-large"],
    [22550, 6950, 1.03, "tree-medium"],
    [15600, 8190, 1.09, "bush-large"],
    [17420, 8350, 1.06, "bush-large"],
    [19160, 8350, 0.93, "bush-small"],
    [20900, 8220, 1.08, "bush-large"],
    [22740, 8040, 0.97, "bush-small"],
    [1330, 9520, 1.06, "tree-medium"],
    [2950, 9390, 0.97, "bush-large"],
    [4940, 9310, 0.92, "bush-small"],
    [6530, 9280, 0.90, "bush-small"],
    [8650, 9290, 1.03, "bush-large"],
    [10030, 9240, 0.99, "bush-medium"],
    [11940, 9560, 0.99, "bush-small"],
    [13890, 9470, 0.98, "bush-small"],
    [15710, 9230, 1.01, "tree-large"],
    [17360, 9240, 0.92, "tree-medium"],
    [19040, 9340, 0.93, "bush-large"],
    [20680, 9310, 0.97, "bush-small"],
    [22810, 9250, 0.90, "bush-small"],
    [1200, 10440, 1.04, "bush-small"],
    [3050, 10490, 0.92, "bush-medium"],
    [4930, 10410, 1.00, "tree-large"],
    [6510, 10570, 1.06, "bush-medium"],
    [8630, 10420, 0.93, "bush-large"],
    [10250, 10740, 1.05, "bush-medium"],
    [12100, 10660, 1.01, "bush-large"],
    [13900, 10550, 0.97, "bush-large"],
    [15690, 10630, 1.06, "bush-large"],
    [17350, 10480, 1.01, "bush-large"],
    [19250, 10620, 1.04, "bush-medium"],
    [20970, 10560, 0.97, "bush-medium"],
    [22640, 10630, 1.04, "tree-medium"],
    [1200, 11720, 1.02, "tree-large"],
    [3360, 11820, 1.03, "bush-medium"],
    [4750, 11660, 0.97, "tree-large"],
    [6580, 11640, 1.10, "bush-small"],
    [8330, 11910, 1.01, "tree-medium"],
    [10410, 11650, 1.10, "bush-small"],
    [11810, 11570, 1.00, "bush-small"],
    [13710, 11600, 0.96, "tree-medium"],
    [15340, 11760, 0.91, "tree-medium"],
    [17140, 11870, 1.07, "tree-large"],
    [18920, 11580, 1.04, "bush-medium"],
    [20780, 11770, 0.95, "tree-medium"],
    [22650, 11920, 1.02, "tree-large"],
    [1470, 13060, 0.94, "tree-large"],
    [2950, 12800, 0.97, "bush-medium"],
    [4760, 13100, 0.97, "tree-medium"],
    [6700, 12970, 0.98, "bush-small"],
    [8270, 12790, 0.95, "tree-medium"],
    [10330, 12920, 1.08, "tree-medium"],
    [12100, 13040, 0.95, "bush-medium"],
    [13950, 12910, 0.94, "bush-large"],
    [15700, 12790, 0.98, "bush-large"],
    [17170, 12920, 1.04, "tree-large"],
    [19000, 13050, 1.02, "bush-large"],
    [21000, 12920, 0.92, "tree-large"],
    [22720, 12880, 0.98, "bush-large"]
  ],

  grass: [
    [700, 950, 0.95],
    [1300, 800, 1.0],
    [2100, 1300, 0.9],
    [2800, 1500, 1.0],
    [600, 1650, 0.9],
    [1200, 2700, 1.0],
    [2200, 2800, 0.95],
    [3100, 2750, 0.9],
    [900, 3480, 0.95],
    [2200, 3600, 0.9],
    [600, 4700, 1.0],
    [1500, 4900, 0.9],
    [2400, 5750, 1.0],
    [3100, 4550, 0.95],
    [800, 5900, 0.9],
    [1800, 6200, 0.95],
    [3700, 2400, 0.95],
    [6900, 2700, 0.9],
    [3700, 4700, 0.9],
    [6900, 4400, 0.95],
    [8400, 2800, 0.9],
    [8400, 4600, 1.0],
    [3900, 3400, 0.95],
    [5600, 3600, 0.9],
    [4300, 4400, 0.9],
    [5000, 2900, 0.95],
    [6350, 2600, 0.95],
    [7300, 3300, 0.9],
    [8100, 4400, 0.95],
    [6700, 5700, 0.9],
    [8700, 3500, 0.95],
    [7600, 2300, 0.9],
    [9300, 1400, 0.95],
    [10300, 3100, 0.9],
    [11300, 1300, 1.0],
    [12400, 2100, 0.9],
    [13500, 1700, 0.95],
    [14500, 2400, 0.9],
    [10500, 4900, 0.95],
    [11800, 4100, 0.9],
    [13200, 4500, 0.95],
    [14200, 3900, 0.9],
    [10800, 6600, 1.0],
    [12100, 6100, 0.9],
    [13600, 6900, 0.95],
    [11400, 8100, 0.9],
    [12700, 7400, 0.95],
    [14200, 8400, 0.9],

    // Grass in the new east and south ground.
    [14740, 1670, 1.00],
    [16620, 1570, 1.00],
    [18720, 1410, 0.93],
    [20360, 1620, 1.03],
    [22470, 1570, 1.05],
    [14820, 2990, 0.90],
    [16720, 2850, 0.94],
    [18750, 2840, 0.98],
    [20350, 2920, 1.02],
    [22390, 2780, 0.97],
    [14860, 4190, 1.01],
    [16560, 4130, 0.94],
    [18720, 4190, 1.01],
    [20440, 4340, 0.92],
    [22370, 4450, 0.92],
    [14890, 5760, 1.02],
    [16580, 5700, 0.93],
    [18670, 5600, 0.99],
    [20300, 5750, 1.04],
    [22290, 5660, 0.95],
    [16740, 7160, 1.04],
    [18480, 6910, 0.97],
    [20600, 6900, 0.98],
    [22220, 6980, 1.02],
    [14840, 8440, 1.05],
    [16620, 8280, 0.99],
    [18490, 8210, 0.91],
    [20320, 8500, 0.92],
    [22480, 8470, 1.04],
    [1690, 9790, 1.00],
    [3460, 9710, 0.93],
    [5510, 9690, 0.99],
    [7240, 9740, 1.02],
    [9040, 9620, 0.92],
    [11200, 9640, 0.99],
    [12900, 9740, 0.98],
    [14730, 9570, 1.04],
    [16870, 9820, 0.96],
    [18540, 9580, 1.01],
    [20490, 9580, 1.01],
    [22420, 9730, 0.92],
    [1800, 11040, 0.96],
    [3490, 10950, 0.95],
    [5540, 11170, 0.93],
    [7120, 10900, 0.97],
    [9310, 11200, 0.96],
    [11060, 11230, 0.96],
    [13120, 11070, 1.02],
    [14700, 10960, 0.95],
    [16640, 11050, 1.01],
    [18600, 11190, 1.01],
    [20550, 10920, 0.92],
    [22270, 11170, 0.90],
    [1510, 12410, 1.01],
    [3550, 12580, 0.96],
    [5390, 12510, 0.93],
    [7230, 12570, 0.93],
    [9120, 12450, 0.97],
    [10930, 12270, 1.02],
    [12770, 12320, 1.03],
    [14930, 12590, 1.00],
    [16760, 12510, 1.01],
    [18540, 12450, 1.05],
    [20580, 12300, 0.94],
    [22510, 12250, 0.96]
  ],

  // Open woodland: no gates either. The trees are the scenery and nothing here
  // blocks movement.

  portals: [
    {
      id: "west-gate",
      label: "Biện Kinh",
      rect: { x: 120, y: 6650, w: 420, h: 700 },
      targetMapId: "market",
      targetSpawn: { x: 10300, y: 5500 }
    }
  ],

  /** No friendly NPCs live here yet; the portal is the only service. */
  npcs: [],

  /** Level bands used by the map validation test and the minimap legend. */
  zones: [
    // Distance from the entrance stands in for danger: near trees, middle wood,
    // black heart of the forest. The gaps between the bands (x ~8000-8300 and
    // ~16000-16300) are deliberately empty, so each camp is a long walk away.
    { id: "ngoai-thanh", minLevel: 1, maxLevel: 10, bounds: zone(380, 380, 8000, 13620) },
    { id: "trung-thanh", minLevel: 11, maxLevel: 20, bounds: zone(8300, 380, 16000, 13620) },
    { id: "noi-thanh", minLevel: 21, maxLevel: 30, bounds: zone(16300, 380, 23200, 13620) }
  ],

  enemySpawns: expandCamps(CAMPS)
};
