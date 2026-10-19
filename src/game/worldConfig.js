/**
 * Pure world layout constants shared by the Phaser scene, the React map UI and
 * the Node multiplayer server. Keep this module free of Phaser/React imports so
 * the server can load it directly.
 *
 * The walled city is square (like the reference Biện Kinh map). Its layout was
 * traced from that reference image, then uniformly scaled by the two factors
 * below so the whole world can grow without touching gameplay code.
 */

/** Ground rectangle enclosed by the Biện Kinh city walls. */
export const CITY_BOUNDS = { x0: 900, y0: 600, x1: 28900, y1: 28600 };

/** Size scale for entities/props. */
export const WORLD_SCALE = 5;
/** Extra spacing scale for the layout (positions only). */
export const WORLD_SPREAD = 2;

/** Layout position scale (spacing) — size scale times the extra spread. */
export const WORLD_POSITION_SCALE = WORLD_SCALE * WORLD_SPREAD;
/** Movement speed multiplier on top of the position scale (game feel knob). */
export const WORLD_SPEED_SCALE = 0.6;

export const WORLD_CONFIG = {
  width: 32000,
  height: 32000,
  cityBounds: CITY_BOUNDS
};

/**
 * Landmark buildings on the ground plane. Both the 3D scene and the minimap
 * read from here, so a layout change never leaves the map out of date.
 */
export const CITY_BUILDINGS = [
  { id: "apothecary", x: 1400, y: 300, w: 1900, d: 1050 },
  { id: "bank", x: 14600, y: 2000, w: 1900, d: 1250 },
  { id: "tavern", x: 700, y: 9000, w: 1700, d: 1150 },
  { id: "academy", x: 15800, y: 7200, w: 1800, d: 1200 },
  { id: "pavilion", x: 10800, y: 3600, w: 850, d: 700 },
  { id: "dragon", x: 10600, y: 8600, w: 850, d: 600 }
];

/** Main paved avenues crossing the city. */
export const CITY_AVENUES = {
  horizontal: { y: 13790, height: 450 },
  vertical: { x: 23000, width: 450 }
};

/** Large open plaza in the centre of the city (statue at its centre). */
export const CITY_PLAZA = { x: 15690, y: 11640, w: 3500, h: 2600 };

/** Multi-tier pagoda near the plaza. */
export const CITY_PAGODAS = [
  { id: "main-pagoda", cx: 10850, cy: 4820, size: 500, tiers: 5 }
];

/** Decorative trees in the street gaps and plaza edges. */
export const CITY_TREES = [
  [6510, 9770, 0.9],
  [6510, 14720, 1.0],
  [6510, 24640, 1.1],
  [11370, 14720, 0.9],
  [12060, 15340, 1.0],
  [19340, 17200, 1.1],
  [19340, 20300, 0.9],
  [14140, 11010, 1.0],
  [15520, 21170, 1.1],
  [22110, 23770, 0.9],
  [25570, 23770, 1.0],
  [18640, 10390, 1.1],
  [24950, 10640, 0.9],
  [7210, 27730, 1.0],
  [19340, 27730, 1.1],
  [15000, 11000, 1],
  [23000, 11000, 1],
  [15000, 17500, 1],
  [23500, 17500, 1],
];

/**
 * Residential blocks traced from the reference Biện Kinh map. Each entry is a
 * courtyard house footprint on the ground plane.
 */
export const CITY_HOUSES = [
  { id: "house-001", x: 6630, y: 10370, w: 1700, d: 950 },
  { id: "house-002", x: 11480, y: 18570, w: 1075, d: 950 },
  { id: "house-003", x: 3150, y: 21610, w: 1355, d: 615 },
  { id: "house-004", x: 8640, y: 19350, w: 1255, d: 665 },
  { id: "house-005", x: 7230, y: 23850, w: 1355, d: 690 },
  { id: "house-006", x: 5690, y: 17830, w: 1230, d: 665 },
  { id: "house-007", x: 15230, y: 22510, w: 820, d: 790 },
  { id: "house-008", x: 2620, y: 6240, w: 920, d: 585 },
  { id: "house-009", x: 14690, y: 18830, w: 995, d: 895 },
  { id: "house-010", x: 12020, y: 23780, w: 870, d: 585 },
  { id: "house-011", x: 5700, y: 19690, w: 945, d: 585 },
  { id: "house-012", x: 10980, y: 20580, w: 870, d: 585 },
  { id: "house-013", x: 4610, y: 12470, w: 790, d: 510 },
  { id: "house-014", x: 19560, y: 17430, w: 765, d: 640 },
  { id: "house-015", x: 9090, y: 22080, w: 945, d: 535 },
  { id: "house-016", x: 25820, y: 17720, w: 750, d: 585 },
  { id: "house-017", x: 11260, y: 17090, w: 790, d: 535 },
  { id: "house-018", x: 25750, y: 26450, w: 870, d: 435 },
  { id: "house-019", x: 25890, y: 5300, w: 820, d: 510 },
  { id: "house-020", x: 5550, y: 16000, w: 750, d: 485 },
  { id: "house-021", x: 17430, y: 20060, w: 750, d: 535 },
  { id: "house-022", x: 18410, y: 22060, w: 750, d: 435 },
  { id: "house-023", x: 6150, y: 1590, w: 750, d: 535 },
  { id: "house-024", x: 6610, y: 22330, w: 945, d: 400 },
  { id: "house-025", x: 8700, y: 16100, w: 750, d: 410 },
  { id: "house-026", x: 20080, y: 19930, w: 750, d: 535 },
  { id: "house-027", x: 2620, y: 16010, w: 750, d: 510 },
  { id: "house-028", x: 11810, y: 16400, w: 750, d: 400 },
  { id: "house-029", x: 17240, y: 17510, w: 750, d: 510 },
  { id: "house-030", x: 10150, y: 23740, w: 750, d: 485 },
  { id: "house-031", x: 25620, y: 15920, w: 750, d: 400 },
  { id: "house-032", x: 12580, y: 23000, w: 750, d: 400 },
  { id: "house-033", x: 17140, y: 10600, w: 750, d: 400 },
  { id: "house-034", x: 2420, y: 26640, w: 750, d: 400 },
  { id: "house-035", x: 3850, y: 19700, w: 750, d: 460 },
  { id: "house-036", x: 17240, y: 19200, w: 750, d: 435 },
  { id: "house-037", x: 26020, y: 9940, w: 750, d: 400 },
  { id: "house-038", x: 3320, y: 3380, w: 750, d: 400 },
  { id: "house-039", x: 17940, y: 22890, w: 750, d: 400 },
  { id: "house-040", x: 17440, y: 5570, w: 750, d: 435 },
  { id: "house-041", x: 11560, y: 22170, w: 750, d: 400 },
  { id: "house-042", x: 9580, y: 17350, w: 750, d: 400 },
  { id: "house-043", x: 25660, y: 3280, w: 750, d: 400 },
  { id: "house-044", x: 25720, y: 1920, w: 750, d: 400 },
  { id: "house-045", x: 5410, y: 16850, w: 750, d: 400 },
  { id: "house-046", x: 25700, y: 2610, w: 750, d: 400 },
  { id: "house-047", x: 24240, y: 26140, w: 750, d: 400 },
  { id: "house-048", x: 3910, y: 23440, w: 750, d: 400 },
  { id: "house-049", x: 15040, y: 6100, w: 750, d: 400 },
  { id: "house-050", x: 26540, y: 16640, w: 750, d: 400 },
  { id: "house-051", x: 26050, y: 12670, w: 750, d: 400 },
  { id: "house-052", x: 10130, y: 11520, w: 750, d: 400 },
  { id: "house-053", x: 18840, y: 10410, w: 750, d: 400 },
  { id: "house-054", x: 25130, y: 8980, w: 750, d: 400 },
  { id: "house-055", x: 6310, y: 8740, w: 750, d: 400 },
  { id: "house-056", x: 20260, y: 4480, w: 750, d: 400 },
  { id: "house-057", x: 20430, y: 5810, w: 750, d: 400 },
  { id: "house-058", x: 15140, y: 18020, w: 750, d: 400 },
  { id: "house-059", x: 3170, y: 11400, w: 750, d: 400 },
  { id: "house-060", x: 3980, y: 24150, w: 750, d: 400 },
  { id: "house-061", x: 6240, y: 15110, w: 750, d: 400 },
  { id: "house-062", x: 8790, y: 12480, w: 750, d: 400 },
  { id: "house-063", x: 12670, y: 9640, w: 750, d: 400 },
  { id: "house-064", x: 6970, y: 17070, w: 750, d: 400 },
  { id: "house-065", x: 9580, y: 15110, w: 750, d: 400 },
  { id: "house-066", x: 13820, y: 11370, w: 750, d: 400 },
  { id: "house-067", x: 24530, y: 4190, w: 750, d: 400 },
  { id: "house-068", x: 20980, y: 8360, w: 750, d: 400 },
  { id: "house-069", x: 12800, y: 17830, w: 750, d: 400 },
  { id: "house-070", x: 15740, y: 17200, w: 750, d: 400 },
  { id: "house-071", x: 19970, y: 23250, w: 750, d: 400 },
  { id: "house-072", x: 8440, y: 20700, w: 750, d: 400 },
  { id: "house-073", x: 19710, y: 3330, w: 750, d: 400 },
  { id: "house-074", x: 11390, y: 25110, w: 750, d: 400 },
  { id: "house-075", x: 19910, y: 9100, w: 750, d: 400 },
  { id: "house-076", x: 19020, y: 23860, w: 750, d: 400 },
  { id: "house-077", x: 25730, y: 25440, w: 750, d: 400 },
  { id: "house-078", x: 6570, y: 2750, w: 750, d: 400 },
  { id: "house-079", x: 4350, y: 26580, w: 750, d: 400 },
  { id: "house-080", x: 20710, y: 10360, w: 750, d: 400 },
  { id: "house-081", x: 6720, y: 3790, w: 750, d: 400 },
];
