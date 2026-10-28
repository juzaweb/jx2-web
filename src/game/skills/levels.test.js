import { describe, it, expect } from "vitest";
import {
  MAX_SKILL_LEVEL,
  MIN_CHARACTER_LEVEL_TO_LEARN,
  SKILL_LEVEL_BONUS_PER_LEVEL,
  SKILL_LEVELS_PER_CHARACTER_LEVEL,
  SKILL_EXP_POOL_SHARE,
  SKILL_PRICE_UNLOCK_BASE,
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
  skillUnlockPriceFactor,
  skillUpgradeCost
} from "./levels.js";
import { skillById } from "../skills.js";
import { nextExpForLevel } from "../progression.js";

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
    // Rank 2 costs 20 * 2² bạc / 30 * 2² EXP, rank 10 costs 20 * 10² / 30 * 10².
    expect(skillUpgradeCost(1)).toEqual({ coinsBac: 80, coinsDong: 8000, exp: 120 });
    expect(skillUpgradeCost(2)).toEqual({ coinsBac: 180, coinsDong: 18000, exp: 270 });
    expect(skillUpgradeCost(9)).toEqual({ coinsBac: 2000, coinsDong: 200000, exp: 3000 });
    expect(skillUpgradeCost(MAX_SKILL_LEVEL)).toBeNull();

    const first = skillUpgradeCost(1);
    const last = skillUpgradeCost(9);
    // Quadratic, not linear: the last rank costs 25x the first one.
    expect(last.coinsBac / first.coinsBac).toBeCloseTo(25);

    // Studying a book buys rank 1, the cheapest step in the same curve.
    expect(skillLearnCost()).toEqual({
      coinsBac: SKILL_UPGRADE_COINS_FACTOR,
      coinsDong: SKILL_UPGRADE_COINS_FACTOR * 100,
      exp: SKILL_UPGRADE_EXP_FACTOR
    });
  });

  it("debits 100 đồng for every quoted bạc, surcharge included", () => {
    for (let level = 1; level < MAX_SKILL_LEVEL; level++) {
      const cost = skillUpgradeCost(level);
      expect(cost.coinsDong).toBe(cost.coinsBac * 100);
    }
    // The fractional surcharge must not break the bạc -> đồng ratio.
    for (const skill of [{ unlockLevel: 18 }, { unlockLevel: 26 }, { unlockLevel: 50 }]) {
      const cost = skillUpgradeCost(1, skill);
      expect(cost.coinsDong).toBe(cost.coinsBac * 100);
      expect(Number.isInteger(cost.coinsBac)).toBe(true);
    }
  });

  it("reports which resource is short before anything is spent", () => {
    const cost = skillUpgradeCost(1);
    expect(skillFundsShortfall(cost, { coins: cost.coinsDong, exp: cost.exp })).toBeNull();
    expect(skillFundsShortfall(cost, null)?.reason).toBe("coins");
    expect(skillFundsShortfall(cost, { coins: cost.coinsDong - 1, exp: 500 })?.reason).toBe(
      "coins"
    );
    expect(skillFundsShortfall(cost, { coins: 1e6, exp: cost.exp - 1 })?.reason).toBe("exp");
    expect(skillFundsShortfall(null, { coins: 0, exp: 0 })).toBeNull();
  });

  it("treats a cost without a đồng figure as unaffordable", () => {
    // Fail closed: a malformed cost must never buy a rank for free.
    const broken = { coinsBac: 80, exp: 0 };
    expect(skillFundsShortfall(broken, { coins: 1e9, exp: 1e9 })?.reason).toBe("coins");
  });
});

describe("skill price by unlock level", () => {
  it("charges list price for the shallow arts and 250x for the level-50 ultimate", () => {
    // The base tier is the study floor, so the two cannot drift apart.
    expect(SKILL_PRICE_UNLOCK_BASE).toBe(MIN_CHARACTER_LEVEL_TO_LEARN);
    // unlock 1 (starter) and unlock 10 both sit at the base tier.
    expect(skillUnlockPriceFactor(skillById("kiem_khi"))).toBe(1);
    expect(skillUnlockPriceFactor(skillById("thieu_lam_tam_phap"))).toBe(1);
    expect(skillUnlockPriceFactor({ unlockLevel: 18 })).toBeCloseTo(2.992);
    expect(skillUnlockPriceFactor({ unlockLevel: 26 })).toBeCloseTo(16.936);
    expect(skillUnlockPriceFactor({ unlockLevel: 34 })).toBeCloseTo(54.784);
    expect(skillUnlockPriceFactor({ unlockLevel: 50 })).toBe(250);
  });

  it("caps the surcharge and falls back to list price for an unknown art", () => {
    expect(skillUnlockPriceFactor({ unlockLevel: 80 })).toBe(250);
    expect(skillUnlockPriceFactor(undefined)).toBe(1);
    expect(skillUnlockPriceFactor(null)).toBe(1);
    expect(skillUnlockPriceFactor("nope")).toBe(1);
  });

  it("prices the ultimate's rank 2 at exactly 200 vàng", () => {
    const ultimate = skillById("nhu_lai_than_chuong");
    expect(ultimate.unlockLevel).toBe(50);
    // 20 * 2² * 250 bạc = 20.000 bạc = 2.000.000 đồng; EXP is 30 * 2² * 250.
    expect(skillUpgradeCost(1, ultimate)).toEqual({
      coinsBac: 20000,
      coinsDong: 2000000,
      exp: 30000
    });
    // Rank 10 is still 25x rank 2 on the same quadratic curve, but its EXP is
    // capped at 90% of what a level-86 hero (50 + 4 * 9) can hold.
    expect(skillUpgradeCost(9, ultimate)).toEqual({
      coinsBac: 500000,
      coinsDong: 50000000,
      exp: 610447
    });
  });

  it("never quotes more EXP than the rank's required level can pay", () => {
    // Under the cap: rank 8 quotes 30 * 8² * 250 EXP, less than a level-78 pool.
    expect(skillUpgradeCost(7, { unlockLevel: 50 }).exp).toBe(480000);
    // Over the cap: rank 9 would quote 607.500, so it stops at 90% of the
    // level-82 pool (602.640), leaving a tenth of the bar as headroom.
    expect(skillUpgradeCost(8, { unlockLevel: 50 }).exp).toBe(542376);
    // Rank 10 clips to 90% of the level-86 pool (678.275).
    expect(skillUpgradeCost(9, { unlockLevel: 50 }).exp).toBe(610447);
  });

  it("keeps every rank of every art inside the EXP its required level can pay", () => {
    for (const unlockLevel of [1, 10, 18, 26, 34, 50, 80]) {
      const skill = { unlockLevel };
      for (let level = 1; level < MAX_SKILL_LEVEL; level++) {
        const required = characterLevelForSkillLevel(skill, level + 1);
        const payable = Math.floor(nextExpForLevel(required) * SKILL_EXP_POOL_SHARE);
        expect(skillUpgradeCost(level, skill).exp).toBeLessThanOrEqual(payable);
      }
      expect(skillLearnCost(skill).exp).toBeLessThanOrEqual(
        Math.floor(nextExpForLevel(characterLevelForSkillLevel(skill, 1)) * SKILL_EXP_POOL_SHARE)
      );
    }
  });

  it("rounds the surcharged quote up to a whole coin of each currency", () => {
    // 20 * 2² * 2.992 = 239.36 bạc -> 240 bạc; EXP 30 * 2² * 2.992 = 359.04 -> 360.
    expect(skillUpgradeCost(1, { unlockLevel: 18 })).toEqual({
      coinsBac: 240,
      coinsDong: 24000,
      exp: 360
    });
  });

  it("scales the book price by the same unlock factor", () => {
    // A starter book still costs 20 bạc / 30 EXP; rank 1 is not a free pass.
    expect(skillLearnCost(skillById("kiem_khi"))).toEqual({
      coinsBac: 20,
      coinsDong: 2000,
      exp: 30
    });
    expect(skillLearnCost({ unlockLevel: 18 })).toEqual({
      coinsBac: 60,
      coinsDong: 6000,
      exp: 90
    });
    // The level-50 ultimate costs 50 vàng and 7.500 EXP to study.
    expect(skillLearnCost(skillById("nhu_lai_than_chuong"))).toEqual({
      coinsBac: 5000,
      coinsDong: 500000,
      exp: 7500
    });
  });

  it("keeps the shallow arts on the old curve", () => {
    expect(skillUpgradeCost(1, skillById("kiem_khi"))).toEqual(skillUpgradeCost(1));
    expect(skillUpgradeCost(9, { unlockLevel: 10 })).toEqual(skillUpgradeCost(9));
  });
});

describe("character level per skill rank", () => {
  it("pins the tuning constants the design assumes", () => {
    // Literal guards: a silent change to either number reshapes the whole curve.
    expect(MIN_CHARACTER_LEVEL_TO_LEARN).toBe(10);
    expect(SKILL_LEVELS_PER_CHARACTER_LEVEL).toBe(4);
    expect(MAX_SKILL_LEVEL).toBe(10);
  });

  it("floors every rank at the level-10 study minimum, then adds 4 levels per rank", () => {
    const starter = skillById("kiem_khi");
    expect(starter.unlockLevel).toBe(1);

    // Literal expectations, not derived from the constants: 10 .. 46 in steps of 4.
    expect(characterLevelForSkillLevel(starter, 1)).toBe(10);
    expect(characterLevelForSkillLevel(starter, 2)).toBe(14);
    expect(characterLevelForSkillLevel(starter, 5)).toBe(26);
    expect(characterLevelForSkillLevel(starter, MAX_SKILL_LEVEL)).toBe(46);

    // A catalog entry that unlocks later than the floor keeps its own level, and
    // still gains 4 levels per rank (Như Lai Thần Chưởng: 50 .. 86).
    expect(characterLevelForSkillLevel({ unlockLevel: 18 }, 1)).toBe(18);
    expect(characterLevelForSkillLevel({ unlockLevel: 18 }, 2)).toBe(22);
    expect(characterLevelForSkillLevel({ unlockLevel: 50 }, MAX_SKILL_LEVEL)).toBe(86);

    // A bare number is accepted too, and junk clamps to the study floor.
    expect(characterLevelForSkillLevel(20, 1)).toBe(20);
    expect(characterLevelForSkillLevel(5, 1)).toBe(10);
    expect(characterLevelForSkillLevel(null, 1)).toBe(10);
    expect(characterLevelForSkillLevel({}, 3)).toBe(18);
  });
});
