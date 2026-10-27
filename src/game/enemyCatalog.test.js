import { describe, expect, it } from "vitest";

import { MONSTERS, MONSTER_IDS, getMonster, monstersBetween, rewardForMonster } from "./enemyCatalog.js";

describe("enemy catalog", () => {
  it("ships the expected number of monsters per level tier and no boss", () => {
    const tiers = [
      [1, 10, 2],
      [11, 20, 2],
      [21, 29, 2],
      [30, 44, 3],
      [45, 60, 3]
    ];

    for (const [min, max, count] of tiers) {
      // `soi-xam` is the legacy market wolf and shares the lowest band; the town
      // roster is the hunting monsters each tier adds.
      const inTier = monstersBetween(min, max).filter(
        (monster) => monster.id !== "soi-xam"
      );
      expect(inTier).toHaveLength(count);
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
