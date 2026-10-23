/**
 * Đông Môn Thành — the wide forest east of Biện Kinh.
 *
 * The hero steps off the realm road into open woodland and pushes east: the near
 * trees hold levels 3-8, the middle wood 14-19 and the black heart of the forest
 * 24-29. The bands sit far apart on purpose — each is its own hunting camp, with
 * bare woodland you have to walk through between them.
 *
 * No walls, no paving, no shops and no boss — the floor is painted forest and the
 * only man-made mark is the dirt trail through it.
 *
 * Pure data, no Phaser imports: the same numbers drive the client renderer, the
 * minimap and the server roster.
 */

/** Inclusive rectangle helper for the tier zones. */
const zone = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

/** @type {import("./mapRegistry.js").MapDefinition} */
export const DONG_MON_THANH_MAP = {
  id: "dong-mon-thanh",
  name: "Đông Môn Thành",
  safe: false,

  bounds: { x0: 0, y0: 0, x1: 15000, y1: 9000 },
  /** At the forest entrance, clear of the return portal rect. */
  spawn: { x: 1200, y: 3920 },

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
      { x: 260, y: 260, w: 14480, h: 8480, fill: 0x44523a, alpha: 0.35 },
      { x: 9800, y: 260, w: 4940, h: 8480, fill: 0x2c3724, alpha: 0.42 },
      // A clearing follows the trail.
      { x: 260, y: 3480, w: 14480, h: 1000, fill: 0x4f5d3d, alpha: 0.3 },
      // Canopy shadows.
      { x: 380, y: 380, w: 2600, h: 2400, fill: 0x2f3a28, alpha: 0.33 },
      { x: 1800, y: 5600, w: 2800, h: 3000, fill: 0x2f3a28, alpha: 0.3 }
    ],
    streets: [
      {
        // One trodden trail through the whole wood: painted earth, no kerb, no
        // paving texture.
        x: 260,
        y: 3720,
        w: 14060,
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
    [14300, 7700, 0.9, "bush-large"]
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
    [14200, 8400, 0.9]
  ],

  // Open woodland: no gates either. The trees are the scenery and nothing here
  // blocks movement.

  portals: [
    {
      id: "west-gate",
      label: "Biện Kinh",
      rect: { x: 120, y: 3550, w: 420, h: 700 },
      targetMapId: "market",
      targetSpawn: { x: 10300, y: 5500 }
    }
  ],

  /** No friendly NPCs live here yet; the portal is the only service. */
  npcs: [],

  /** Level bands used by the map validation test and the minimap legend. */
  zones: [
    // Distance from the entrance stands in for danger: near trees, middle wood,
    // black heart of the forest. The gaps between the bands (y/x ~5000 and
    // ~9900) are deliberately empty, so each camp is a walk away.
    { id: "ngoai-thanh", minLevel: 1, maxLevel: 10, bounds: zone(380, 380, 5000, 8620) },
    { id: "trung-thanh", minLevel: 11, maxLevel: 20, bounds: zone(5200, 380, 9800, 8620) },
    { id: "noi-thanh", minLevel: 21, maxLevel: 30, bounds: zone(10000, 380, 14400, 8620) }
  ],

  enemySpawns: [
    // Near trees (levels 3-8) — one camp per clearing, ~700-1200 apart.
    { id: 0, monsterId: "son-ca", x: 900, y: 1200 },
    { id: 1, monsterId: "son-ca", x: 1700, y: 700 },
    { id: 2, monsterId: "da-lang", x: 2500, y: 1500 },
    { id: 3, monsterId: "son-ca", x: 3400, y: 850 },
    { id: 4, monsterId: "da-lang", x: 4300, y: 1250 },
    { id: 5, monsterId: "son-ca", x: 4700, y: 2400 },
    { id: 6, monsterId: "son-ca", x: 1000, y: 2600 },
    { id: 7, monsterId: "da-lang", x: 2000, y: 3000 },
    { id: 8, monsterId: "son-ca", x: 3200, y: 2700 },
    { id: 9, monsterId: "da-lang", x: 4400, y: 3200 },
    { id: 10, monsterId: "son-ca", x: 1500, y: 5000 },
    { id: 11, monsterId: "da-lang", x: 2600, y: 5600 },
    { id: 12, monsterId: "son-ca", x: 3700, y: 5900 },
    { id: 13, monsterId: "da-lang", x: 900, y: 6600 },
    { id: 14, monsterId: "son-ca", x: 2200, y: 7200 },
    { id: 15, monsterId: "da-lang", x: 3800, y: 7000 },
    { id: 16, monsterId: "son-ca", x: 4600, y: 7800 },

    // Middle wood (levels 14-19).
    { id: 17, monsterId: "lam-tac", x: 5600, y: 1500 },
    { id: 18, monsterId: "hac-y-sat-thu", x: 6500, y: 900 },
    { id: 19, monsterId: "lam-tac", x: 7600, y: 1600 },
    { id: 20, monsterId: "hac-y-sat-thu", x: 8700, y: 1000 },
    { id: 21, monsterId: "lam-tac", x: 9500, y: 1800 },
    { id: 22, monsterId: "lam-tac", x: 5700, y: 3300 },
    { id: 23, monsterId: "hac-y-sat-thu", x: 6900, y: 3100 },
    { id: 24, monsterId: "lam-tac", x: 8100, y: 3500 },
    { id: 25, monsterId: "hac-y-sat-thu", x: 9400, y: 3800 },
    { id: 26, monsterId: "lam-tac", x: 5900, y: 5400 },
    { id: 27, monsterId: "hac-y-sat-thu", x: 7200, y: 5700 },
    { id: 28, monsterId: "lam-tac", x: 8600, y: 6100 },
    { id: 29, monsterId: "hac-y-sat-thu", x: 6100, y: 7300 },
    { id: 30, monsterId: "lam-tac", x: 7700, y: 7700 },
    { id: 31, monsterId: "hac-y-sat-thu", x: 9000, y: 7900 },

    // Black heart of the forest (levels 24-29).
    { id: 32, monsterId: "thiet-giap-binh", x: 10200, y: 1200 },
    { id: 33, monsterId: "ma-giao-de-tu", x: 11100, y: 800 },
    { id: 34, monsterId: "thiet-giap-binh", x: 12300, y: 1500 },
    { id: 35, monsterId: "ma-giao-de-tu", x: 13500, y: 1100 },
    { id: 36, monsterId: "thiet-giap-binh", x: 14300, y: 1900 },
    { id: 37, monsterId: "thiet-giap-binh", x: 10300, y: 3500 },
    { id: 38, monsterId: "ma-giao-de-tu", x: 11600, y: 2900 },
    { id: 39, monsterId: "thiet-giap-binh", x: 12800, y: 3700 },
    { id: 40, monsterId: "ma-giao-de-tu", x: 14000, y: 3300 },
    { id: 41, monsterId: "thiet-giap-binh", x: 10500, y: 6000 },
    { id: 42, monsterId: "ma-giao-de-tu", x: 11800, y: 6500 },
    { id: 43, monsterId: "thiet-giap-binh", x: 13200, y: 5800 },
    { id: 44, monsterId: "ma-giao-de-tu", x: 14300, y: 7100 },
    { id: 45, monsterId: "ma-giao-de-tu", x: 11100, y: 7900 },
    { id: 46, monsterId: "thiet-giap-binh", x: 12600, y: 8200 }
  ]
};
