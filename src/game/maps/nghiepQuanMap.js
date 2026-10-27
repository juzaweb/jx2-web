/**
 * Nghiệp Quan — the northern hunting ground of Ngụy Thành, levels 30-44.
 *
 * A stone pass behind the Ngụy north gate: armoured riders at the foot, spear
 * guards mid-pass, and a black knight holding the fortress road.
 */

import { defineHuntingGround } from "./huntingGround.js";

export const NGHIEP_QUAN_MAP = defineHuntingGround({
  id: "nghiep-quan",
  name: "Nghiệp Quan",
  side: "south",
  cityMapId: "nguy-thanh",
  cityName: "Ngụy Thành",
  citySpawn: { x: 4000, y: 5200 },
  palette: {
    rim: 0x2d3136,
    fill: 0x424850,
    region: 0x4e555f,
    shade: 0x343a41,
    trail: 0x66624f
  },
  groups: [
    { monsterId: "nghiep-quan-giao-ky", y: 10500, minLevel: 30, maxLevel: 34, band: [8500, 14000] },
    { monsterId: "thiet-thuong-binh", y: 6500, minLevel: 35, maxLevel: 39, band: [4500, 8500] },
    { monsterId: "hac-ky-si", y: 2500, minLevel: 40, maxLevel: 44, band: [0, 4500] }
  ]
});
