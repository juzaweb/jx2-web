/**
 * Pure layout data for the Biện Kinh market square shown in the reference
 * screenshot. Kept free of Phaser imports so the scene, minimap and tests can
 * share exactly the same coordinates.
 *
 * The reference uses a top-down 2.5D view, so coordinates are screen-aligned
 * ground units (x right, y down) matching `isoProjection.js`.
 */

/** Ground rectangle covered by the stone market square. */
export const MARKET_PLAZA = { x: 4300, y: 4900, w: 4700, d: 2300 };

/** Walkable area including the dirt apron around the square. */
export const MARKET_BOUNDS = { x0: 2100, y0: 2600, x1: 11000, y1: 9600 };

/** Player spawn / return point, kept compatible with the existing teleport item. */
export const MARKET_SPAWN = { x: 6400, y: 6050 };

/**
 * Landmark shops and structures. `x`/`y` are the screen-space anchor (the
 * building's ground contact point), `w`/`d` are collision footprint sizes.
 */
export const MARKET_BUILDINGS = [
  {
    id: "tap-hoa",
    kind: "shop",
    sign: "TẠP HÓA",
    subSign: "雜貨",
    x: 4550,
    y: 5750,
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
    x: 4550,
    y: 6800,
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
    x: 5150,
    y: 6000,
    w: 500,
    d: 260
  },
  {
    id: "ba-lang",
    kind: "gate",
    sign: "BÁ LÃNG",
    subSign: "霸陵",
    x: 7000,
    y: 6600,
    w: 900,
    d: 320
  },
  {
    id: "stall-red",
    kind: "stall",
    sign: "",
    x: 7650,
    y: 5450,
    w: 1000,
    d: 700,
    awning: "red"
  },
  {
    id: "stall-blue",
    kind: "stall",
    sign: "",
    x: 8350,
    y: 7250,
    w: 1000,
    d: 700,
    awning: "blue"
  }
];

/** Decorative stone lanterns around the square. */
export const MARKET_LANTERNS = [
  [4420, 5010],
  [8520, 5010],
  [4420, 7080],
  [8520, 7080],
  [6650, 5010],
  [8520, 6100],
  [5200, 7080]
];

/** Trees, bushes and rocks around the paved square. */
export const MARKET_TREES = [
  [2850, 3450, 1.1, "pine"],
  [3050, 4750, 0.95, "round"],
  [9900, 4750, 1.0, "pine"],
  [3100, 6250, 0.9, "round"],
  [10050, 6200, 0.95, "round"],
  [2950, 4700, 0.95, "round"],
  [2750, 6100, 1.05, "round"],
  [2800, 7600, 1.15, "pine"],
  [3000, 8700, 0.95, "round"],
  [4300, 8850, 1.05, "round"],
  [5700, 8900, 0.9, "pine"],
  [7450, 8850, 1.1, "round"],
  [9000, 8850, 1.0, "pine"],
  [10100, 8000, 0.95, "round"],
  [10300, 6400, 1.05, "pine"],
  [10200, 4700, 0.9, "round"],
  [9800, 3400, 1.0, "round"],
  [8300, 3150, 0.95, "pine"],
  [6500, 3050, 1.05, "round"],
  [5000, 3200, 0.9, "round"],
  [3200, 3200, 0.9, "round"]
];

/** Loose props (crates, sacks, barrels, jars) placed around the shops. */
export const MARKET_PROPS = [
  { kind: "crate-stack", x: 5100, y: 4650, s: 1 },
  { kind: "crate-stack", x: 5450, y: 4550, s: 0.8 },
  { kind: "sacks", x: 3150, y: 5300, s: 1 },
  { kind: "barrel", x: 3150, y: 5700, s: 1 },
  { kind: "jar-cluster", x: 5350, y: 6300, s: 1 },
  { kind: "jar-cluster", x: 3150, y: 7000, s: 0.9 },
  { kind: "basket", x: 5600, y: 4700, s: 0.9 },
  { kind: "basket", x: 8400, y: 5050, s: 0.8 },
  { kind: "crate-stack", x: 8800, y: 7900, s: 0.85 },
  { kind: "sacks", x: 7700, y: 7900, s: 0.9 },
  { kind: "barrel", x: 7600, y: 4350, s: 0.9 },
  { kind: "jar-cluster", x: 9350, y: 6500, s: 0.8 },
  { kind: "crate-stack", x: 6100, y: 4750, s: 0.9 }
];

/** Stone emblems / drains painted on the square. */
export const MARKET_MEDALLIONS = [
  { x: 6900, y: 6500, r: 260 },
  { x: 5000, y: 5300, r: 120 }
];

