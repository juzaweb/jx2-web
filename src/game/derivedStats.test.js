import { describe, expect, it } from "vitest";

import { deriveCombatStats, deriveGearCombatBonuses } from "./derivedStats.js";
import { defaultEquipment } from "./equipment.js";

describe("deriveGearCombatBonuses", () => {
  it("returns zero bonuses for an empty loadout", () => {
    expect(deriveGearCombatBonuses(defaultEquipment())).toEqual({
      attack: 0,
      defense: 0,
      critRate: 0
    });
  });

  it("sums only the combat bonuses of worn gear", () => {
    const equipment = { ...defaultEquipment(), armor: "ao-lang-khach", helmet: "non-lang-khach" };
    expect(deriveGearCombatBonuses(equipment)).toEqual({
      attack: 0,
      defense: 13,
      critRate: 0
    });
  });
});

describe("deriveCombatStats", () => {
  it("returns the level-1 baseline with no gear or buffs", () => {
    const stats = deriveCombatStats();
    expect(stats).toEqual({
      level: 1,
      attack: 24,
      defense: 6,
      critRate: 0.12,
      critDamage: 1.5,
      attackSpeed: 1,
      speedPct: 0,
      maxHp: 100,
      maxMp: 60,
      nextExp: 100
    });
  });

  it("folds gear into attack, defense and crit only", () => {
    const equipment = {
      ...defaultEquipment(),
      armor: "ao-lang-khach",
      helmet: "non-lang-khach",
      pants: "quan-lang-khach"
    };
    const stats = deriveCombatStats({ equipment });
    expect(stats.attack).toBe(24);
    expect(stats.defense).toBe(23);
    // Armour's maxHp and the hat's maxMp bonuses stay unused by design.
    expect(stats.maxHp).toBe(100);
    expect(stats.maxMp).toBe(60);
  });

  it("derives HP/MP ceilings and next EXP from the level alone", () => {
    const stats = deriveCombatStats({ level: 3 });
    expect(stats.level).toBe(3);
    expect(stats.maxHp).toBe(140);
    expect(stats.maxMp).toBe(80);
    expect(stats.nextExp).toBe(210);
    expect(stats.attack).toBe(24);
  });

  it("applies active buffs and ignores expired ones", () => {
    const now = 10_000;
    const buffs = [
      { stat: "attackPct", amount: 0.5, until: now + 1000 },
      { stat: "defensePct", amount: 0.3, until: now + 1000 },
      { stat: "critRate", amount: 0.05, until: now + 1000 },
      { stat: "speedPct", amount: 0.2, until: now + 1000 },
      { stat: "attackPct", amount: 1, until: now - 1 }
    ];
    const stats = deriveCombatStats({ buffs, now });
    expect(stats.attack).toBe(36);
    expect(stats.defense).toBe(8);
    expect(stats.critRate).toBe(0.17);
    expect(stats.speedPct).toBe(0.2);
  });

  it("clamps crit rate into [0, 1]", () => {
    const stats = deriveCombatStats({
      buffs: [{ stat: "critRate", amount: 5, until: Date.now() + 1000 }]
    });
    expect(stats.critRate).toBe(1);
  });

  it("normalizes an invalid level to the progression floor", () => {
    expect(deriveCombatStats({ level: Number.NaN }).level).toBe(1);
    expect(deriveCombatStats({ level: -5 }).level).toBe(1);
    expect(deriveCombatStats({ level: 9999 }).level).toBe(150);
  });
});
