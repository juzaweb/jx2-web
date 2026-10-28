/**
 * Canonical identity of every friendly city NPC: display name, role, sprite
 * sheet and tint. Locations are per-map and live in the layout modules
 * (`marketLayout.js`, `factionCityLayout.js`); identity is shared so a rename or
 * re-tint can never drift between Biện Kinh and the faction capitals.
 *
 * Keep this module Phaser-free: the server imports the map registry, which
 * transitively reaches this table.
 */

/** @type {Readonly<Record<string, {name:string, role:string, sprite:string, tint?:number, shop?:string}>>} */
export const CITY_NPC_IDENTITIES = Object.freeze({
  "da-tau": { name: "Dã Tẩu", role: "quest", sprite: "npc-citizen", tint: 0xc8a878 },
  "chu-tiem-vu-khi": {
    name: "Chủ Tiệm Vũ Khí",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xd8c0a0
  },
  "chu-tiem-do-nam": {
    name: "Chủ Tiệm Trang Phục Nam",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xa8c8e8
  },
  "chu-tiem-do-nu": {
    name: "Chủ Tiệm Trang Phục Nữ",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xe8b8d0
  },
  "chu-tiem-trang-suc": {
    name: "Chủ Tiệm Trang Sức",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xffe08a
  },
  "duoc-su": {
    name: "Dược Sư",
    role: "service",
    sprite: "npc-duoc",
    shop: "pharmacy"
  },
  "chu-tiem-tap-hoa": {
    name: "Chủ Tạp Hóa",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xc0d8a0
  },
  "ve-binh-thanh-mon": {
    name: "Vệ Binh Thành Môn",
    role: "quest",
    sprite: "npc-citizen",
    tint: 0xb0b8c8
  },
  "vo-su": { name: "Võ Sư", role: "quest", sprite: "npc-citizen", tint: 0xd0b090 },
  "thu-kho": { name: "Thủ Khố", role: "quest", sprite: "npc-citizen", tint: 0xc0a880 },
  "chu-tuu-lau": { name: "Chủ Tửu Lầu", role: "quest", sprite: "npc-citizen", tint: 0xe0b080 },
  "tieu-su": { name: "Tiêu Sư", role: "quest", sprite: "npc-citizen", tint: 0xb8a8d0 },
  "bach-hieu-sinh": { name: "Bách Hiểu Sinh", role: "quest", sprite: "npc-citizen", tint: 0xbfa06a },
  "trieu-dien-nien": { name: "Triệu Diên Niên", role: "quest", sprite: "npc-citizen", tint: 0xd8d0b0 }
});

/**
 * Build one placed NPC from its canonical identity.
 * @param {string} id canonical NPC id
 * @param {number} x ground x
 * @param {number} y ground y
 * @param {Record<string, unknown>} [extra] map-specific fields such as `building`
 * @returns {object} map NPC definition
 */
export function cityNpc(id, x, y, extra = {}) {
  const identity = CITY_NPC_IDENTITIES[id];
  if (!identity) throw new TypeError(`unknown city NPC: ${id}`);
  return { id, ...identity, x, y, ...extra };
}
