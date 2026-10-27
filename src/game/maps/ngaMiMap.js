/**
 * Nga Mi — the western hunting ground of Thục Thành, levels 45-60.
 *
 * Misty jade ridges behind the Thục west gate: sword maidens, a frost silkworm,
 * and an asura guardian in the cloudline.
 */

import { defineHuntingGround } from "./huntingGround.js";

export const NGA_MI_MAP = defineHuntingGround({
  id: "nga-mi",
  name: "Nga Mi",
  side: "east",
  cityMapId: "thuc-thanh",
  cityName: "Thục Thành",
  citySpawn: { x: 1800, y: 4000 },
  palette: {
    rim: 0x283a36,
    fill: 0x3c514b,
    region: 0x476059,
    shade: 0x2e403b,
    trail: 0x60705f
  },
  groups: [
    { monsterId: "nga-mi-kiem-nu", y: 10500, minLevel: 45, maxLevel: 49, band: [8500, 14000] },
    { monsterId: "bang-tam-yeu", y: 6500, minLevel: 50, maxLevel: 54, band: [4500, 8500] },
    { monsterId: "tu-la-han", y: 2500, minLevel: 55, maxLevel: 60, band: [0, 4500] }
  ]
});
