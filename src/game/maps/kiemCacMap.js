/**
 * Kiếm Các — the northern hunting ground of Thục Thành, levels 30-44.
 *
 * A narrow mountain pass behind the Thục north gate: sword disciples at the
 * foot, iron guardians mid-climb, and a poison master at the summit.
 */

import { defineHuntingGround } from "./huntingGround.js";

export const KIEM_CAC_MAP = defineHuntingGround({
  id: "kiem-cac",
  name: "Kiếm Các",
  side: "south",
  cityMapId: "thuc-thanh",
  cityName: "Thục Thành",
  citySpawn: { x: 4000, y: 5200 },
  palette: {
    rim: 0x2b332b,
    fill: 0x414b3d,
    region: 0x4c5947,
    shade: 0x313b30,
    trail: 0x6f6046
  },
  groups: [
    { monsterId: "kiem-cac-vu-sinh", y: 10500, minLevel: 30, maxLevel: 34, band: [8500, 14000] },
    { monsterId: "thiet-diep-binh", y: 6500, minLevel: 35, maxLevel: 39, band: [4500, 8500] },
    { monsterId: "doc-cong-tu", y: 2500, minLevel: 40, maxLevel: 44, band: [0, 4500] }
  ]
});
