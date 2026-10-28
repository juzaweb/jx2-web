/**
 * Shared shop and NPC roster for the two faction capitals: Thành Đô (Thục) and
 * Lạc Dương (Ngụy).
 *
 * Both cities are the same 8000x8000 walled square with a cross of paved
 * avenues, so one authored layout serves both. Only the building ids are
 * prefixed per city (`thuc-duoc-diem`, `nguy-duoc-diem`); NPC ids stay identical
 * because the newbie quest chain refers to them by id on whichever map the hero
 * is standing on.
 *
 * Keep this module Phaser-free: the map definitions, the minimap and the tests
 * import it directly.
 */

import { cityNpc } from "./npcRoster.js";

/** Distance from a shop facade to the shopkeeper standing in front of it. */
const SHOP_NPC_OFFSET = 180;

/**
 * One entry per shop: the building footprint plus the keeper that stands at its
 * door. Coordinates are ground units in the shared 8000x8000 city square.
 *
 * Shops ring the central crossing without touching the two avenues
 * (`x 3400..4600` and `y 3400..4600`), so the hero can always walk up to them.
 */
const CITY_SHOPS = Object.freeze([
  {
    key: "duoc-diem",
    sign: "DƯỢC ĐIỂM",
    subSign: "藥舖",
    signColor: "green",
    palette: "herb",
    x: 2300,
    y: 2800,
    w: 2000,
    d: 900,
    scale: 2.8,
    npcId: "duoc-su"
  },
  {
    key: "vu-khi",
    sign: "VŨ KHÍ",
    subSign: "武器",
    signColor: "red",
    palette: "wood",
    x: 5400,
    y: 2700,
    w: 1600,
    d: 800,
    scale: 2.4,
    npcId: "chu-tiem-vu-khi"
  },
  {
    key: "tap-hoa",
    sign: "TẠP HÓA",
    subSign: "雜貨",
    signColor: "red",
    palette: "wood",
    x: 7100,
    y: 2700,
    w: 1600,
    d: 800,
    scale: 2.4,
    npcId: "chu-tiem-tap-hoa"
  },
  {
    key: "do-nam",
    sign: "Y PHỤC NAM",
    subSign: "男裝",
    signColor: "red",
    palette: "wood",
    x: 2300,
    y: 5300,
    w: 1600,
    d: 800,
    scale: 2.4,
    npcId: "chu-tiem-do-nam"
  },
  {
    key: "do-nu",
    sign: "Y PHỤC NỮ",
    subSign: "女裝",
    signColor: "green",
    palette: "wood",
    x: 5400,
    y: 5300,
    w: 1600,
    d: 800,
    scale: 2.4,
    npcId: "chu-tiem-do-nu"
  },
  {
    key: "trang-suc",
    sign: "TRANG SỨC",
    subSign: "首飾",
    signColor: "green",
    palette: "wood",
    x: 7100,
    y: 5300,
    w: 1600,
    d: 800,
    scale: 2.4,
    npcId: "chu-tiem-trang-suc"
  },
  {
    key: "tuu-lau",
    sign: "TỬU LẦU",
    subSign: "酒樓",
    signColor: "red",
    palette: "wood",
    x: 1700,
    y: 6400,
    w: 2200,
    d: 900,
    scale: 2.8,
    npcId: "chu-tuu-lau"
  }
]);

/**
 * Quest NPCs that do not own a shop: the quest giver, the gate guard, the
 * martial master, the quartermaster, the escort chief, the scholar and the
 * letter's recipient. Identities come from `npcRoster.js`; only their spots on
 * the avenues live here.
 */
const CITY_FREE_NPCS = Object.freeze([
  { id: "da-tau", x: 4200, y: 6000 },
  { id: "ve-binh-thanh-mon", x: 7400, y: 4000 },
  { id: "vo-su", x: 2600, y: 4000 },
  { id: "thu-kho", x: 1700, y: 1900 },
  { id: "tieu-su", x: 6400, y: 4200 },
  { id: "bach-hieu-sinh", x: 4000, y: 4150 },
  { id: "trieu-dien-nien", x: 6700, y: 7000 }
]);

/**
 * @param {string} prefix city id prefix ("thuc" / "nguy")
 * @returns {string}
 */
function requirePrefix(prefix) {
  if (typeof prefix !== "string" || prefix.length === 0) {
    throw new TypeError("faction city prefix must be a non-empty string");
  }
  return prefix;
}

/**
 * Shop footprints for a faction capital.
 * @param {string} prefix city id prefix ("thuc" / "nguy")
 * @returns {Array<object>} map building definitions
 */
export function factionCityBuildings(prefix) {
  const city = requirePrefix(prefix);
  return CITY_SHOPS.map((shop) => ({
    id: `${city}-${shop.key}`,
    kind: "shop",
    sign: shop.sign,
    subSign: shop.subSign,
    signColor: shop.signColor,
    palette: shop.palette,
    x: shop.x,
    y: shop.y,
    w: shop.w,
    d: shop.d,
    scale: shop.scale
  }));
}

/**
 * Full newbie-quest NPC roster for a faction capital: every shopkeeper at their
 * door plus the quest NPCs that stand on the avenues.
 * @param {string} prefix city id prefix ("thuc" / "nguy")
 * @returns {Array<object>} map NPC definitions
 */
export function factionCityNpcs(prefix) {
  const city = requirePrefix(prefix);
  const shopkeepers = CITY_SHOPS.map((shop) =>
    cityNpc(shop.npcId, shop.x, shop.y + SHOP_NPC_OFFSET, { building: `${city}-${shop.key}` })
  );
  return [...shopkeepers, ...CITY_FREE_NPCS.map((npc) => cityNpc(npc.id, npc.x, npc.y))];
}
