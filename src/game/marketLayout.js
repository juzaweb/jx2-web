/**
 * Pure layout data for the Kiến Nghiệp market square shown in the reference
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
 *
 * `sprite` picks a sheet (`npc-citizen` is the temporary procedural placeholder)
 * and `tint` differentiates roles on that shared sheet. `role: "quest"` NPCs are
 * pure dialogue; only the Dược Sư keeps a real shop counter.
 */
export const MARKET_NPCS = [
  {
    id: "da-tau",
    name: "Dã Tẩu",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xc8a878,
    x: 6400,
    y: 5700
  },
  {
    id: "chu-tiem-vu-khi",
    name: "Chủ Tiệm Vũ Khí",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xd8c0a0,
    x: 7000,
    y: 4580
  },
  {
    id: "chu-tiem-do-nam",
    name: "Chủ Tiệm Trang Phục Nam",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xa8c8e8,
    x: 8600,
    y: 4580
  },
  {
    id: "chu-tiem-do-nu",
    name: "Chủ Tiệm Trang Phục Nữ",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xe8b8d0,
    x: 7000,
    y: 7080
  },
  {
    id: "chu-tiem-trang-suc",
    name: "Chủ Tiệm Trang Sức",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xffe08a,
    x: 8600,
    y: 7080
  },
  {
    id: "duoc-su",
    name: "Dược Sư",
    shop: "pharmacy",
    role: "service",
    sprite: "npc-duoc",
    building: "duoc-diem",
    x: 4300,
    y: 7020
  },
  {
    id: "chu-tiem-tap-hoa",
    name: "Chủ Tạp Hóa",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xc0d8a0,
    x: 4300,
    y: 4580
  },
  {
    id: "ve-binh-thanh-mon",
    name: "Vệ Binh Thành Môn",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xb0b8c8,
    x: 10150,
    y: 6000
  },
  {
    id: "vo-su",
    name: "Võ Sư",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xd0b090,
    x: 5600,
    y: 4700
  },
  {
    id: "thu-kho",
    name: "Thủ Khố",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xc0a880,
    x: 3000,
    y: 4700
  },
  {
    id: "chu-tuu-lau",
    name: "Chủ Tửu Lầu",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xe0b080,
    x: 5200,
    y: 8220
  },
  {
    id: "tieu-su",
    name: "Tiêu Sư",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xb8a8d0,
    x: 9600,
    y: 6800
  },
  {
    id: "bach-hieu-sinh",
    name: "Bách Hiểu Sinh",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xbfa06a,
    x: 7400,
    y: 6000
  },
  {
    id: "trieu-dien-nien",
    name: "Triệu Diên Niên",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xd8d0b0,
    x: 8600,
    y: 8100
  }
];

/**
 * Shop buildings across the square. `x`/`y` are the screen-space anchor (the
 * building's ground contact point), `w`/`d` are collision footprint sizes.
 */
export const MARKET_BUILDINGS = [
  {
    id: "tap-hoa",
    kind: "shop",
    sign: "TẠP HÓA",
    subSign: "雜貨",
    x: 4300,
    y: 4400,
    w: 2000,
    d: 900,
    scale: 2.8,
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
    w: 2000,
    d: 900,
    scale: 2.8,
    signColor: "green",
    palette: "herb"
  },
  {
    id: "vu-khi",
    kind: "shop",
    sign: "VŨ KHÍ",
    subSign: "武器",
    x: 7000,
    y: 4400,
    w: 1600,
    d: 800,
    scale: 2.4,
    signColor: "red",
    palette: "wood"
  },
  {
    id: "do-nam",
    kind: "shop",
    sign: "Y PHỤC NAM",
    subSign: "男裝",
    x: 8600,
    y: 4400,
    w: 1600,
    d: 800,
    scale: 2.4,
    signColor: "red",
    palette: "wood"
  },
  {
    id: "do-nu",
    kind: "shop",
    sign: "Y PHỤC NỮ",
    subSign: "女裝",
    x: 7000,
    y: 6900,
    w: 1600,
    d: 800,
    scale: 2.4,
    signColor: "green",
    palette: "wood"
  },
  {
    id: "trang-suc",
    kind: "shop",
    sign: "TRANG SỨC",
    subSign: "首飾",
    x: 8600,
    y: 6900,
    w: 1600,
    d: 800,
    scale: 2.4,
    signColor: "green",
    palette: "wood"
  },
  {
    id: "tuu-lau",
    kind: "shop",
    sign: "TỬU LẦU",
    subSign: "酒樓",
    x: 5200,
    y: 8100,
    w: 2200,
    d: 900,
    scale: 2.8,
    signColor: "red",
    palette: "wood"
  }
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
  [5800, 3050, 1.05, "tree-large"],
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
  [5900, 9350, 1.05],
  [8600, 9400, 0.85],
  [3500, 8000, 0.95],
  [5600, 8600, 1.0],
  [9800, 8700, 0.9]
];

/**
 * Paved walkways. The east-west avenue runs from the west gate through the square
 * to the east gate, while the north-south avenue links the north and south gates.
 */
export const MARKET_WALKWAY = { x: 2100, y: 4900, w: 8800, d: 1200 };
export const MARKET_AVENUE_NS = { x: 6200, y: 2600, w: 1200, d: 6900 };

/** Stone emblems / drains painted on the walkway. */
export const MARKET_MEDALLIONS = [
  { x: 6600, y: 5900, r: 260 },
  { x: 4700, y: 5650, r: 120 }
];
