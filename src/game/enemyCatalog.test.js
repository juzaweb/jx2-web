import { describe, expect, it } from "vitest";

import { MONSTERS, MONSTER_IDS, getMonster, monstersBetween, rewardForMonster } from "./enemyCatalog.js";

describe("enemy catalog", () => {
  it("covers every level band with several species and no boss", () => {
    const bands = [
      [1, 10],
      [11, 20],
      [21, 29],
      [30, 44],
      [45, 60]
    ];

    for (const [min, max] of bands) {
      // Three camps share each band now (one per faction plus Ngô's older tiers);
      // the legacy market wolf is scenery, not a hunting species.
      const inBand = monstersBetween(min, max).filter(
        (monster) => monster.id !== "soi-xam"
      );
      expect(inBand.length).toBeGreaterThanOrEqual(3);
    }

    expect(MONSTER_IDS.map((id) => MONSTERS[id]).filter((m) => m.isBoss)).toHaveLength(0);
  });

  it("keeps every id unique and every stat sane", () => {
    expect(new Set(MONSTER_IDS).size).toBe(MONSTER_IDS.length);

    for (const id of MONSTER_IDS) {
      const monster = MONSTERS[id];
      expect(monster.id).toBe(id);
      expect(monster.name.length).toBeGreaterThan(0);
      expect(monster.level).toBeGreaterThanOrEqual(1);
      expect(monster.level).toBeLessThanOrEqual(60);
      expect(monster.maxHp).toBeGreaterThan(0);
      expect(monster.attack).toBeGreaterThan(0);
      expect(monster.defense).toBeGreaterThanOrEqual(0);
      expect(monster.exp).toBeGreaterThan(0);
      expect(monster.coinsMax).toBeGreaterThanOrEqual(monster.coinsMin);
      expect(monster.visual?.kind).toBeTruthy();
      expect(monster.visual?.palette).toBeTruthy();
    }
  });

  it("pays the legacy wolf exactly what the server tests expect", () => {
    const wolf = getMonster("soi-xam");
    expect(wolf.exp).toBe(35);

    for (const roll of [0, 0.5, 0.999999]) {
      const reward = rewardForMonster("soi-xam", roll);
      expect(reward.exp).toBe(35);
      expect(reward.coins).toBeGreaterThanOrEqual(3);
      expect(reward.coins).toBeLessThanOrEqual(9);
    }
  });

  it("rolls deterministic coins inside the monster's band", () => {
    for (const id of MONSTER_IDS) {
      const monster = MONSTERS[id];
      expect(rewardForMonster(id, 0).coins).toBe(monster.coinsMin);
      expect(rewardForMonster(id, 1).coins).toBe(monster.coinsMax);
      expect(rewardForMonster(id, 0.5).coins).toBe(rewardForMonster(id, 0.5).coins);
    }
  });

  it("falls back to the wolf for an unknown id", () => {
    expect(getMonster("khong-ton-tai").id).toBe("soi-xam");
    expect(getMonster().id).toBe("soi-xam");
  });

  it("keeps every monster on the default respawn timer", () => {
    for (const id of MONSTER_IDS) {
      expect(MONSTERS[id].respawnMs).toBeUndefined();
      expect(Boolean(MONSTERS[id].isBoss)).toBe(false);
    }
  });
});
