/**
 * Hứa Điền — the eastern hunting ground of Ngụy Thành, levels 3-29.
 *
 * Farmland behind the Ngụy east gate: field rats in the near paddies, wild
 * wolves in the middle, road bandits at the far farmsteads.
 */

import { defineHuntingGround } from "./huntingGround.js";

export const HUA_DIEN_MAP = defineHuntingGround({
  id: "hua-dien",
  name: "Hứa Điền",
  side: "west",
  cityMapId: "nguy-thanh",
  cityName: "Ngụy Thành",
  citySpawn: { x: 6200, y: 4000 },
  palette: {
    rim: 0x3a3428,
    fill: 0x504733,
    region: 0x5d5340,
    shade: 0x3d372a,
    trail: 0x776546
  },
  groups: [
    { monsterId: "dien-thu", y: 10500, minLevel: 1, maxLevel: 10, band: [8500, 14000] },
    { monsterId: "hoang-lang", y: 6500, minLevel: 11, maxLevel: 20, band: [4500, 8500] },
    { monsterId: "lua-dao-tac", y: 2500, minLevel: 21, maxLevel: 29, band: [0, 4500] }
  ]
});
