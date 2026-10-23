/**
 * Đông Môn Thành — the walled town east of Biện Kinh.
 *
 * The hero enters through the west gate, walks a paved avenue lined with shops,
 * and pushes east through three courtyards of rising danger (levels 1-10, 11-20,
 * 21-30) to the keep, where a level-30 boss holds the last courtyard.
 *
 * Pure data, no Phaser imports: the same numbers drive the client renderer, the
 * minimap and the server roster.
 */

const WALL = 260;

/** Inclusive rectangle helper for the tier zones. */
const zone = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

/** @type {import("./mapRegistry.js").MapDefinition} */
export const DONG_MON_THANH_MAP = {
  id: "dong-mon-thanh",
  name: "Đông Môn Thành",
  safe: false,

  bounds: { x0: 0, y0: 0, x1: 9000, y1: 7000 },
  /** Just inside the west gate, outside the gate portal rect. */
  spawn: { x: 1100, y: 3500 },

  ground: {
    rim: 0x3d4636,
    fill: 0x7b7263,
    tileKey: "ground-bricks",
    tileAlpha: 0.9,
    pad: 380,
    walkway: {
      x: 260,
      y: 3060,
      w: 8480,
      d: 880,
      rotation: -0.04,
      tileKey: "ground-walkway",
      tint: 0xa89b84,
      tileScale: 0.5
    },
    medallions: [{ x: 8100, y: 3500, r: 420 }]
  },

  // Reuses the two shop sprites the market already ships.
  buildings: [
    {
      id: "dong-mon-tap-hoa",
      kind: "shop",
      sign: "TẠP HÓA",
      subSign: "雜貨",
      x: 1800,
      y: 3050,
      w: 2000,
      d: 900,
      scale: 2.6,
      signColor: "red",
      palette: "wood"
    },
    {
      id: "dong-mon-duoc-diem",
      kind: "shop",
      sign: "DƯỢC ĐIỂM",
      subSign: "藥舖",
      x: 4000,
      y: 3050,
      w: 2000,
      d: 900,
      scale: 2.6,
      signColor: "green",
      palette: "herb"
    },
    {
      id: "dong-mon-tuu-quan",
      kind: "shop",
      sign: "TỬU QUÁN",
      subSign: "酒館",
      x: 1800,
      y: 4150,
      w: 2000,
      d: 900,
      scale: 2.5,
      signColor: "red",
      palette: "wood"
    },
    {
      id: "dong-mon-thiet-pho",
      kind: "shop",
      sign: "THIẾT PHỐ",
      subSign: "鐵舖",
      x: 4000,
      y: 4150,
      w: 2000,
      d: 900,
      scale: 2.5,
      signColor: "green",
      palette: "herb"
    }
  ],

  trees: [
    [600, 1200, 1.0, "tree-large"],
    [3150, 620, 0.95, "tree-medium"],
    [3200, 2600, 0.9, "bush-large"],
    [600, 6100, 1.05, "tree-large"],
    [2900, 6350, 0.95, "bush-medium"],
    [3600, 900, 0.95, "tree-medium"],
    [6000, 700, 1.0, "tree-large"],
    [3550, 6300, 0.9, "bush-large"],
    [6100, 6300, 1.05, "tree-large"],
    [6400, 900, 0.9, "bush-medium"],
    [8600, 620, 0.95, "tree-medium"],
    [8550, 6400, 1.0, "tree-large"],
    [7000, 6200, 0.9, "bush-small"],
    [8450, 2400, 0.9, "bush-medium"]
  ],

  grass: [
    [900, 2200, 0.95],
    [1500, 800, 0.9],
    [2600, 2400, 1.0],
    [3300, 4400, 0.9],
    [1200, 6400, 0.95],
    [4500, 700, 1.0],
    [5200, 2500, 0.9],
    [5900, 4200, 0.95],
    [6300, 2000, 1.05],
    [6800, 4600, 0.9],
    [7800, 700, 0.95],
    [8300, 5600, 1.0]
  ],

  /**
   * Town wall: an outer ring with a gate opening on the west, two partition
   * walls that split the courtyards (their gaps sit on the avenue), and the keep
   * that encloses the boss.
   */
  walls: [
    // Outer ring.
    { id: "north", x: 0, y: 0, w: 9000, h: WALL },
    { id: "south", x: 0, y: 7000 - WALL, w: 9000, h: WALL },
    { id: "west-north", x: 0, y: WALL, w: WALL, h: 3100 - WALL },
    { id: "west-south", x: 0, y: 3900, w: WALL, h: 7000 - WALL - 3900 },
    { id: "east", x: 9000 - WALL, y: WALL, w: WALL, h: 7000 - WALL * 2 },

    // Courtyard partitions: open across the avenue (y 3060-3940).
    { id: "split-1-north", x: 3320, y: WALL, w: 140, h: 2800 - WALL },
    { id: "split-1-south", x: 3320, y: 3940, w: 140, h: 6740 - 3940 },
    { id: "split-2-north", x: 6120, y: WALL, w: 140, h: 2800 - WALL },
    { id: "split-2-south", x: 6120, y: 3940, w: 140, h: 6740 - 3940 },

    // Boss keep: a courtyard open only to the avenue.
    { id: "keep-north", x: 6960, y: 2400, w: 1780, h: 140 },
    { id: "keep-south", x: 6960, y: 4460, w: 1780, h: 140 }
  ],

  gates: [
    {
      id: "dong-mon-west-gate",
      x: 0,
      y: 3100,
      w: WALL,
      h: 800,
      orientation: "vertical",
      label: "Đông Môn"
    },
    {
      id: "dong-mon-keep-gate",
      x: 6960,
      y: 3060,
      w: 140,
      h: 880,
      orientation: "vertical",
      label: "Nội Thành"
    }
  ],

  banners: [
    { x: 900, y: 3060 },
    { x: 2800, y: 3060 },
    { x: 4700, y: 3060 },
    { x: 6600, y: 3060 }
  ],

  braziers: [
    { x: 620, y: 3020 },
    { x: 620, y: 3980 },
    { x: 7080, y: 3020 },
    { x: 7080, y: 3980 }
  ],

  portals: [
    {
      id: "west-gate",
      label: "Biện Kinh",
      rect: { x: 120, y: 3150, w: 420, h: 700 },
      targetMapId: "market",
      targetSpawn: { x: 10300, y: 5500 }
    }
  ],

  /** No friendly NPCs live here yet; the portal is the only service. */
  npcs: [],

  /** Level bands used by the map validation test and the minimap legend. */
  zones: [
    { id: "ngoai-thanh", minLevel: 1, maxLevel: 10, bounds: zone(380, 380, 3320, 6620) },
    { id: "trung-thanh", minLevel: 11, maxLevel: 20, bounds: zone(3460, 380, 6120, 6620) },
    { id: "noi-thanh", minLevel: 21, maxLevel: 30, bounds: zone(6260, 380, 8740, 6620) }
  ],

  enemySpawns: [
    // Tier 1 — outer fields (levels 3-8).
    { id: 0, monsterId: "son-ca", x: 1200, y: 1500 },
    { id: 1, monsterId: "son-ca", x: 1900, y: 1050 },
    { id: 2, monsterId: "da-lang", x: 2650, y: 1650 },
    { id: 3, monsterId: "da-lang", x: 3100, y: 1000 },
    { id: 4, monsterId: "son-ca", x: 1250, y: 5400 },
    { id: 5, monsterId: "son-ca", x: 2200, y: 5850 },
    { id: 6, monsterId: "da-lang", x: 2950, y: 5100 },
    { id: 7, monsterId: "da-lang", x: 1000, y: 4550 },

    // Tier 2 — middle courtyards (levels 14-19).
    { id: 8, monsterId: "lam-tac", x: 3850, y: 1500 },
    { id: 9, monsterId: "lam-tac", x: 4400, y: 2300 },
    { id: 10, monsterId: "hac-y-sat-thu", x: 5050, y: 1200 },
    { id: 11, monsterId: "hac-y-sat-thu", x: 5700, y: 2000 },
    { id: 12, monsterId: "lam-tac", x: 3900, y: 5300 },
    { id: 13, monsterId: "lam-tac", x: 4600, y: 4700 },
    { id: 14, monsterId: "hac-y-sat-thu", x: 5450, y: 5800 },
    { id: 15, monsterId: "hac-y-sat-thu", x: 5950, y: 4900 },

    // Tier 3 — inner city (levels 24-29).
    { id: 16, monsterId: "thiet-giap-binh", x: 6600, y: 1500 },
    { id: 17, monsterId: "thiet-giap-binh", x: 7150, y: 2200 },
    { id: 18, monsterId: "ma-giao-de-tu", x: 7900, y: 1300 },
    { id: 19, monsterId: "thiet-giap-binh", x: 6700, y: 5400 },
    { id: 20, monsterId: "ma-giao-de-tu", x: 7600, y: 5800 },
    { id: 21, monsterId: "ma-giao-de-tu", x: 8250, y: 4900 },

    // Boss — the keep.
    { id: 22, monsterId: "dong-mon-tuong-quan", x: 8100, y: 3500 }
  ]
};
