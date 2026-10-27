/**
 * Ba Thục — the eastern hunting ground of Thục Thành, levels 3-29.
 *
 * Bamboo lowland behind the Thục east gate: wolves in the near canes, bamboo
 * vipers in the middle, bandits holding the far treeline.
 */

import { defineHuntingGround } from "./huntingGround.js";

export const BA_THUC_MAP = defineHuntingGround({
  id: "ba-thuc",
  name: "Ba Thục",
  side: "west",
  cityMapId: "thuc-thanh",
  cityName: "Thục Thành",
  citySpawn: { x: 6200, y: 4000 },
  palette: {
    rim: 0x26372c,
    fill: 0x3a4c3c,
    region: 0x445a48,
    shade: 0x2c3d31,
    trail: 0x6f7a53
  },
  groups: [
    { monsterId: "thuc-lang", y: 10500, minLevel: 1, maxLevel: 10, band: [8500, 14000] },
    { monsterId: "truc-xa", y: 6500, minLevel: 11, maxLevel: 20, band: [4500, 8500] },
    { monsterId: "ba-thuc-son-tac", y: 2500, minLevel: 21, maxLevel: 29, band: [0, 4500] }
  ]
});
