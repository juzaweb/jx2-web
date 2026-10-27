/**
 * Thục Thành — the Thục faction's home city.
 *
 * Phase 1 keeps it deliberately minimal: a walled square with a herb shop and
 * four gates. Only the south gate is open — it leads to the central battlefield,
 * which is the sole road to the other two cities. The north/east/west arches are
 * built but shut until their hunting grounds ship.
 *
 * Pure data, no Phaser imports.
 */

/** @type {import("./mapRegistry.js").MapDefinition} */
export const THUC_THANH_MAP = {
  id: "thuc-thanh",
  name: "Thục Thành",
  /** City: no monsters spawn here. */
  safe: true,
  /** City safe zone: neither PvE nor PvP is allowed inside the walls. */
  noCombat: true,
  pvpMode: "none",
  homeFaction: "thuc",

  bounds: { x0: 0, y0: 0, x1: 8000, y1: 8000 },
  spawn: { x: 4000, y: 5600 },

  ground: {
    rim: 0x40503f,
    fill: 0x8a8272,
    tileKey: "ground-bricks",
    tileAlpha: 0.94,
    pad: 320,
    regions: [
      // A warmer paved square in the middle of the dirt apron.
      { x: 1400, y: 1400, w: 5200, h: 5200, fill: 0x9a9280, alpha: 0.55 }
    ],
    streets: []
  },

  buildings: [
    {
      id: "thuc-duoc-diem",
      kind: "shop",
      sign: "DƯỢC ĐIỂM",
      subSign: "藥舖",
      x: 4000,
      y: 4300,
      w: 2000,
      d: 900,
      scale: 2.8,
      signColor: "green",
      palette: "herb"
    }
  ],

  trees: [
    [900, 900, 1.05, "tree-large"],
    [2200, 700, 0.95, "bush-medium"],
    [5700, 800, 1.0, "tree-medium"],
    [7100, 1000, 1.05, "tree-large"],
    [700, 3500, 0.95, "bush-large"],
    [7300, 3600, 1.0, "tree-medium"],
    [800, 6900, 1.05, "tree-large"],
    [2300, 7200, 0.95, "bush-medium"],
    [5700, 7200, 1.0, "tree-medium"],
    [7200, 6900, 0.95, "bush-large"]
  ],

  grass: [
    [1500, 1800, 0.95],
    [6500, 1800, 1.0],
    [1200, 4300, 0.9],
    [6800, 4300, 0.95],
    [1600, 6500, 1.0],
    [6400, 6500, 0.9]
  ],

  npcs: [
    {
      id: "duoc-su",
      name: "Dược Sư",
      shop: "pharmacy",
      building: "thuc-duoc-diem",
      x: 4000,
      y: 4420
    }
  ],

  /** All four gates exist; only the south one is wired in phase 1. */
  gates: [
    { id: "thuc-north-gate", x: 3400, y: 0, w: 1200, h: 130, orientation: "horizontal", label: "Bắc Môn" },
    { id: "thuc-south-gate", x: 3400, y: 7870, w: 1200, h: 130, orientation: "horizontal", label: "Nam Môn" },
    { id: "thuc-west-gate", x: 0, y: 3400, w: 130, h: 1200, orientation: "vertical", label: "Tây Môn" },
    { id: "thuc-east-gate", x: 7870, y: 3400, w: 130, h: 1200, orientation: "vertical", label: "Đông Môn" }
  ],

  portals: [
    {
      id: "south-gate",
      label: "Trung Nguyên Chiến Trường",
      rect: { x: 3400, y: 7600, w: 1200, h: 400 },
      targetMapId: "trung-nguyen",
      targetSpawn: { x: 1600, y: 6000 }
    },
    {
      id: "north-gate",
      label: "Kiếm Các",
      rect: { x: 3400, y: 0, w: 1200, h: 400 },
      targetMapId: "kiem-cac",
      targetSpawn: { x: 7600, y: 12800 }
    },
    {
      id: "east-gate",
      label: "Ba Thục",
      rect: { x: 7600, y: 3400, w: 400, h: 1200 },
      targetMapId: "ba-thuc",
      targetSpawn: { x: 1400, y: 7000 }
    },
    {
      id: "west-gate",
      label: "Nga Mi",
      rect: { x: 0, y: 3400, w: 400, h: 1200 },
      targetMapId: "nga-mi",
      targetSpawn: { x: 14600, y: 7000 }
    }
  ],

  zones: [],
  enemySpawns: []
};
