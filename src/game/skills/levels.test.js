import { describe, it, expect } from "vitest";
import {
  MAX_SKILL_LEVEL,
  SKILL_LEVEL_BONUS_PER_LEVEL,
  SKILL_UPGRADE_COINS_PER_LEVEL,
  SKILL_UPGRADE_EXP_PER_LEVEL,
  normalizeSkillLevel,
  scaleSkillEffect,
  skillAtLevel,
  skillFundsShortfall,
  skillLearnCost,
  skillLevelBonus,
  skillLevelOf,
  skillLevelScale,
  skillUpgradeCost
} from "./levels.js";
import { skillById } from "../skills.js";

describe("skill level normalisation", () => {
  it("clamps into 1..MAX_SKILL_LEVEL", () => {
    expect(MAX_SKILL_LEVEL).toBe(10);
    expect(normalizeSkillLevel(0)).toBe(1);
    expect(normalizeSkillLevel(-4)).toBe(1);
    expect(normalizeSkillLevel("3")).toBe(3);
    expect(normalizeSkillLevel(3.9)).toBe(3);
    expect(normalizeSkillLevel(99)).toBe(MAX_SKILL_LEVEL);
    expect(normalizeSkillLevel("nope")).toBe(1);
    expect(normalizeSkillLevel(undefined)).toBe(1);
  });

  it("reads a level out of a skillId -> level map, defaulting to 1", () => {
    expect(skillLevelOf({ kiem_khi: 4 }, "kiem_khi")).toBe(4);
    expect(skillLevelOf({ kiem_khi: 99 }, "kiem_khi")).toBe(MAX_SKILL_LEVEL);
    expect(skillLevelOf({ kiem_khi: 4 }, "other")).toBe(1);
    expect(skillLevelOf(null, "kiem_khi")).toBe(1);
    expect(skillLevelOf({}, "")).toBe(1);
  });
});

describe("skill level scaling", () => {
  it("is 1 at level 1 and grows by the per-level bonus", () => {
    expect(skillLevelScale(1)).toBe(1);
    expect(skillLevelBonus(1)).toBe(0);
    expect(skillLevelScale(2)).toBeCloseTo(1 + SKILL_LEVEL_BONUS_PER_LEVEL);
    expect(skillLevelScale(MAX_SKILL_LEVEL)).toBeCloseTo(
      1 + SKILL_LEVEL_BONUS_PER_LEVEL * (MAX_SKILL_LEVEL - 1)
    );
  });

  it("scales damage multiplier and effect magnitudes but not control durations", () => {
    const base = skillById("kiem_khi");
    expect(skillAtLevel(base, 1)).toBe(base);

    const strong = skillAtLevel(base, MAX_SKILL_LEVEL);
    expect(strong.id).toBe(base.id);
    expect(strong.mult).toBeCloseTo(base.mult * skillLevelScale(MAX_SKILL_LEVEL));

    const buff = {
      id: "buff_test",
      mult: 0,
      effects: [{ kind: "buff", stat: "attackPct", amount: 0.2, duration: 1000 }]
    };
    expect(skillAtLevel(buff, 2).effects[0].amount).toBeCloseTo(0.2 * 1.1);

    const stun = { kind: "stun", duration: 600, chance: 0.1 };
    expect(scaleSkillEffect(stun, 2)).toBe(stun);

    const heal = scaleSkillEffect({ kind: "heal", amount: 50, pctMaxHp: 0.6 }, 2);
    expect(heal.amount).toBeCloseTo(100);
    // A heal never covers more than the whole pool it scales against.
    expect(heal.pctMaxHp).toBe(1);
  });
});

describe("skill upgrade price", () => {
  it("grows with the level being bought and stops at the cap", () => {
    const first = skillUpgradeCost(1);
    const second = skillUpgradeCost(2);
    expect(first.coins).toBeGreaterThan(0);
    expect(first.exp).toBeGreaterThan(0);
    expect(second.coins).toBeGreaterThan(first.coins);
    expect(second.exp).toBeGreaterThan(first.exp);
    expect(skillUpgradeCost(MAX_SKILL_LEVEL)).toBeNull();
    // Studying a book buys level 1 at the base tier price.
    expect(skillLearnCost()).toEqual({
      coins: SKILL_UPGRADE_COINS_PER_LEVEL,
      exp: SKILL_UPGRADE_EXP_PER_LEVEL
    });
  });

  it("reports which resource is short before anything is spent", () => {
    const cost = { coins: 80, exp: 120 };
    expect(skillFundsShortfall(cost, { coins: 80, exp: 120 })).toBeNull();
    expect(skillFundsShortfall(cost, null)?.reason).toBe("coins");
    expect(skillFundsShortfall(cost, { coins: 79, exp: 500 })?.reason).toBe("coins");
    expect(skillFundsShortfall(cost, { coins: 500, exp: 119 })?.reason).toBe("exp");
    expect(skillFundsShortfall(null, { coins: 0, exp: 0 })).toBeNull();
  });
});
