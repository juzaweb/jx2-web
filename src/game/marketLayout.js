/**
 * Pure layout data for the Biện Kinh market square shown in the reference
 * screenshot. Kept free of Phaser imports so the scene, minimap and tests can
 * share exactly the same coordinates.
 *
 * The reference uses a top-down 2.5D view, so coordinates are screen-aligned
 * ground units (x right, y down) matching `isoProjection.js`.
 */

/** Ground rectangle covered by the stone market square. */
export const MARKET_PLAZA = { x: 3400, y: 3500, w: 6000, d: 4000 };

/** Walkable area including the dirt apron around the square. */
export const MARKET_BOUNDS = { x0: 2100, y0: 2600, x1: 11000, y1: 9600 };

/** Player spawn / return point, kept compatible with the existing teleport item. */
export const MARKET_SPAWN = { x: 6400, y: 6050 };

/**
 * Friendly NPCs. `x`/`y` are the ground contact point; each NPC stands in front
 * of its shop and opens a service when the player interacts with it.
 */
export const MARKET_NPCS = [
  {
    id: "duoc-su",
    name: "Dược Sư",
    shop: "pharmacy",
    building: "duoc-diem",
    x: 4580,
    y: 7120
  }
];

/**
 * Landmark shops and structures spread across the square. `x`/`y` are the
 * screen-space anchor (the building's ground contact point), `w`/`d` are
 * collision footprint sizes.
 */
export const MARKET_BUILDINGS = [
  {
    id: "tap-hoa",
    kind: "shop",
    sign: "TẠP HÓA",
    subSign: "雜貨",
    x: 4300,
    y: 4400,
    w: 1700,
    d: 900,
    signColor: "red",
    palette: "wood"
  },
  {
    id: "duoc-diem",
    kind: "shop",
    sign: "DƯỢC ĐIỂM",
    subSign: "藥舖",
    x: 4300,
    y: 6900,
    w: 1700,
    d: 900,
    signColor: "green",
    palette: "herb"
  },
  {
    id: "cao-thi",
    kind: "board",
    sign: "CAO THỊ",
    subSign: "告示",
    x: 5600,
    y: 4500,
    w: 500,
    d: 260
  },
  {
    id: "ba-lang",
    kind: "gate",
    sign: "BÁ LÃNG",
    subSign: "霸陵",
    x: 7600,
    y: 4800,
    w: 900,
    d: 320
  },
  {
    id: "stall-red",
    kind: "stall",
    sign: "",
    x: 8500,
    y: 4500,
    w: 1000,
    d: 700,
    awning: "red"
  },
  {
    id: "stall-blue",
    kind: "stall",
    sign: "",
    x: 8400,
    y: 6900,
    w: 1000,
    d: 700,
    awning: "blue"
  }
];

/** Decorative stone lanterns around the square. */
export const MARKET_LANTERNS = [
  [3900, 4000],
  [8900, 4000],
  [3900, 7000],
  [8900, 7000],
  [6400, 4000],
  [8900, 5500],
  [6400, 7000],
  [5000, 4000],
  [7800, 4000]
];

/** Trees and bushes ringing the paved square. */
export const MARKET_TREES = [
  [2850, 3450, 1.1, "tree-large"],
  [3050, 4750, 0.95, "bush-large"],
  [9900, 4750, 1.0, "tree-medium"],
  [3100, 6250, 0.9, "bush-medium"],
  [10050, 6200, 0.95, "bush-large"],
  [2950, 4700, 0.95, "bush-small"],
  [2750, 6100, 1.05, "tree-large"],
  [2800, 7600, 1.15, "tree-large"],
  [3000, 8700, 0.95, "bush-medium"],
  [4300, 8850, 1.05, "tree-medium"],
  [5700, 8900, 0.9, "bush-large"],
  [7450, 8850, 1.1, "tree-large"],
  [9000, 8850, 1.0, "tree-medium"],
  [10100, 8000, 0.95, "bush-large"],
  [10300, 6400, 1.05, "tree-medium"],
  [10200, 4700, 0.9, "bush-medium"],
  [9800, 3400, 1.0, "tree-large"],
  [8300, 3150, 0.95, "tree-medium"],
  [6500, 3050, 1.05, "tree-large"],
  [5000, 3200, 0.9, "bush-large"],
  [3200, 3200, 0.9, "tree-medium"]
];

/** Grass tufts scattered along the brick apron outside the square. */
export const MARKET_GRASS = [
  [2300, 3000, 0.9],
  [3800, 2800, 1.0],
  [5200, 2800, 0.85],
  [7800, 2750, 0.95],
  [9600, 2900, 1.0],
  [10600, 3600, 0.9],
  [2440, 4400, 1.05],
  [10650, 5200, 0.9],
  [2380, 7800, 0.95],
  [10600, 7600, 1.0],
  [4700, 9400, 0.9],
  [6800, 9350, 1.05],
  [8600, 9400, 0.85],
  [3500, 8000, 0.95],
  [5600, 8600, 1.0],
  [9800, 8700, 0.9]
];

/** Loose props (crates, sacks, barrels, jars) scattered across the whole map. */
export const MARKET_PROPS = [
  { kind: "crate-stack", x: 3500, y: 3900, s: 1 },
  { kind: "crate-stack", x: 9200, y: 3900, s: 0.85 },
  { kind: "sacks", x: 3500, y: 4700, s: 1 },
  { kind: "barrel", x: 3500, y: 7100, s: 1 },
  { kind: "jar-cluster", x: 5200, y: 6500, s: 1 },
  { kind: "jar-cluster", x: 9200, y: 7100, s: 0.9 },
  { kind: "basket", x: 6400, y: 3900, s: 0.9 },
  { kind: "basket", x: 9000, y: 5200, s: 0.8 },
  { kind: "crate-stack", x: 7000, y: 7200, s: 0.85 },
  { kind: "sacks", x: 8000, y: 3900, s: 0.9 },
  { kind: "barrel", x: 9000, y: 6300, s: 0.9 },
  { kind: "jar-cluster", x: 4200, y: 5400, s: 0.8 },
  { kind: "crate-stack", x: 6000, y: 4700, s: 0.9 },
  { kind: "crate-stack", x: 2450, y: 2950, s: 0.9 },
  { kind: "barrel", x: 10500, y: 3250, s: 0.9 },
  { kind: "sacks", x: 2500, y: 8750, s: 0.9 },
  { kind: "jar-cluster", x: 10300, y: 8700, s: 0.8 }
];

/** Stone emblems / drains painted on the square. */
export const MARKET_MEDALLIONS = [
  { x: 6600, y: 5900, r: 260 },
  { x: 4700, y: 4700, r: 120 }
];
