import { describe, it, expect } from "vitest";
import {
  MAX_SKILL_LEVEL,
  MIN_CHARACTER_LEVEL_TO_LEARN,
  SKILL_LEVEL_BONUS_PER_LEVEL,
  SKILL_LEVELS_PER_CHARACTER_LEVEL,
  SKILL_UPGRADE_COINS_FACTOR,
  SKILL_UPGRADE_EXP_FACTOR,
  characterLevelForSkillLevel,
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
  it("grows with the square of the level being bought and stops at the cap", () => {
    // Rank 2 costs 20 * 2² / 30 * 2², rank 10 costs 20 * 10² / 30 * 10².
    expect(skillUpgradeCost(1)).toEqual({ coins: 80, exp: 120 });
    expect(skillUpgradeCost(2)).toEqual({ coins: 180, exp: 270 });
    expect(skillUpgradeCost(9)).toEqual({ coins: 2000, exp: 3000 });
    expect(skillUpgradeCost(MAX_SKILL_LEVEL)).toBeNull();

    const first = skillUpgradeCost(1);
    const last = skillUpgradeCost(9);
    // Quadratic, not linear: the last rank costs 25x the first one.
    expect(last.coins / first.coins).toBeCloseTo(25);

    // Studying a book buys rank 1, the cheapest step in the same curve.
    expect(skillLearnCost()).toEqual({
      coins: SKILL_UPGRADE_COINS_FACTOR,
      exp: SKILL_UPGRADE_EXP_FACTOR
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

describe("character level per skill rank", () => {
  it("floors every rank at the level-10 study minimum, then adds 4 levels per rank", () => {
    const starter = skillById("kiem_khi");
    expect(starter.unlockLevel).toBe(1);
    // The book's own level is below the study floor, so the floor wins.
    expect(characterLevelForSkillLevel(starter, 1)).toBe(MIN_CHARACTER_LEVEL_TO_LEARN);
    expect(characterLevelForSkillLevel(starter, 2)).toBe(
      MIN_CHARACTER_LEVEL_TO_LEARN + SKILL_LEVELS_PER_CHARACTER_LEVEL
    );
    expect(characterLevelForSkillLevel(starter, MAX_SKILL_LEVEL)).toBe(
      MIN_CHARACTER_LEVEL_TO_LEARN + SKILL_LEVELS_PER_CHARACTER_LEVEL * (MAX_SKILL_LEVEL - 1)
    );

    // A catalog entry that unlocks later than the floor keeps its own level.
    expect(characterLevelForSkillLevel({ unlockLevel: 15 }, 1)).toBe(15);
    expect(characterLevelForSkillLevel({ unlockLevel: 15 }, 2)).toBe(
      15 + SKILL_LEVELS_PER_CHARACTER_LEVEL
    );

    // A bare number is accepted too, and junk clamps to the study floor.
    expect(characterLevelForSkillLevel(20, 1)).toBe(20);
    expect(characterLevelForSkillLevel(5, 1)).toBe(MIN_CHARACTER_LEVEL_TO_LEARN);
    expect(characterLevelForSkillLevel(null, 1)).toBe(MIN_CHARACTER_LEVEL_TO_LEARN);
    expect(characterLevelForSkillLevel({}, 99)).toBe(
      MIN_CHARACTER_LEVEL_TO_LEARN + SKILL_LEVELS_PER_CHARACTER_LEVEL * (MAX_SKILL_LEVEL - 1)
    );
  });
});
