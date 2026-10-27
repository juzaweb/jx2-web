/**
 * Quan Trung — the western hunting ground of Ngụy Thành, levels 45-60.
 *
 * The iron heartland behind the Ngụy west gate: wandering champions, bronze
 * cataphracts, and the self-styled King of Quan Trung.
 */

import { defineHuntingGround } from "./huntingGround.js";

export const QUAN_TRUNG_MAP = defineHuntingGround({
  id: "quan-trung",
  name: "Quan Trung",
  side: "east",
  cityMapId: "nguy-thanh",
  cityName: "Ngụy Thành",
  citySpawn: { x: 1800, y: 4000 },
  palette: {
    rim: 0x2b2f38,
    fill: 0x3e444f,
    region: 0x4a515d,
    shade: 0x323841,
    trail: 0x5f5a49
  },
  groups: [
    { monsterId: "quan-trung-hiep", y: 10500, minLevel: 45, maxLevel: 49, band: [8500, 14000] },
    { monsterId: "dong-trang-thiet-ky", y: 6500, minLevel: 50, maxLevel: 54, band: [4500, 8500] },
    { monsterId: "quan-trung-ba-vuong", y: 2500, minLevel: 55, maxLevel: 60, band: [0, 4500] }
  ]
});
