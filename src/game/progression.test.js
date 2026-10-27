import { describe, it, expect } from "vitest";
import {
  nextExpForLevel,
  vitalsForLevel,
  normalizeProgress,
  applyReward,
  progressPayload,
  NEXT_EXP_GROWTH_BANDS,
  MAX_LEVEL
} from "./progression.js";

describe("MAX_LEVEL", () => {
  it("is the designed character level cap", () => {
    expect(MAX_LEVEL).toBe(99);
  });
});

describe("nextExpForLevel", () => {
  it("follows the 100 * 1.45 curve at the start of the game", () => {
    expect(nextExpForLevel(1)).toBe(100);
    expect(nextExpForLevel(2)).toBe(145);
    expect(nextExpForLevel(3)).toBe(210);
    expect(nextExpForLevel(4)).toBe(304);
    expect(nextExpForLevel(5)).toBe(440);
  });

  it("clamps out-of-range levels", () => {
    expect(nextExpForLevel(0)).toBe(nextExpForLevel(1));
    expect(nextExpForLevel(9999)).toBe(nextExpForLevel(MAX_LEVEL));
  });
});

describe("NEXT_EXP_GROWTH_BANDS", () => {
  it("covers the whole level range with a cooling-down rate", () => {
    expect(NEXT_EXP_GROWTH_BANDS.at(-1).upTo).toBe(MAX_LEVEL);
    const growths = NEXT_EXP_GROWTH_BANDS.map((band) => band.growth);
    for (let i = 1; i < growths.length; i += 1) {
      expect(growths[i]).toBeLessThanOrEqual(growths[i - 1]);
    }
  });

  it("keeps the run to the cap reachable", () => {
    let total = 0;
    for (let level = 1; level < MAX_LEVEL; level += 1) {
      total += nextExpForLevel(level);
    }
    // A flat ×1.45 curve would need ~4×10^17 EXP for level 98 alone.
    expect(nextExpForLevel(MAX_LEVEL - 1)).toBeLessThan(5_000_000);
    expect(total).toBeLessThan(50_000_000);
  });
});

describe("vitalsForLevel", () => {
  it("derives max HP/MP and next EXP from the level", () => {
    expect(vitalsForLevel(1)).toEqual({ maxHp: 100, maxMp: 60, nextExp: 100 });
    expect(vitalsForLevel(5)).toEqual({ maxHp: 180, maxMp: 100, nextExp: 440 });
  });
});

describe("normalizeProgress", () => {
  it("clamps and floors untrusted input", () => {
    expect(normalizeProgress({ level: 0, exp: -5, coins: 2.9, kills: NaN })).toEqual({
      level: 1,
      exp: 0,
      coins: 2,
      kills: 0
    });
    expect(normalizeProgress({ level: 9999 }).level).toBe(MAX_LEVEL);
    expect(normalizeProgress({})).toEqual({ level: 1, exp: 0, coins: 0, kills: 0 });
  });

  it("folds an over-cap save back into a full, in-range bar", () => {
    const legacy = normalizeProgress({ level: 150, exp: 5e16, coins: 10, kills: 4 });
    expect(legacy.level).toBe(MAX_LEVEL);
    expect(legacy.exp).toBe(nextExpForLevel(MAX_LEVEL));
    expect(legacy.exp).toBeLessThan(5_000_000);
  });

  it("caps EXP at the current level's requirement", () => {
    expect(normalizeProgress({ level: 2, exp: 9_999 }).exp).toBe(nextExpForLevel(2));
    expect(normalizeProgress({ level: 2, exp: 30 }).exp).toBe(30);
  });
});

describe("applyReward", () => {
  it("adds rewards without a level-up", () => {
    expect(applyReward({ level: 1, exp: 10, coins: 0, kills: 0 }, { exp: 20, coins: 5, kills: 1 })).toEqual({
      level: 1,
      exp: 30,
      coins: 5,
      kills: 1,
      levelUps: 0
    });
  });

  it("resolves a level-up and carries the remainder", () => {
    expect(applyReward({ level: 1, exp: 0, coins: 0, kills: 0 }, { exp: 100 })).toEqual({
      level: 2,
      exp: 0,
      coins: 0,
      kills: 0,
      levelUps: 1
    });
  });

  it("resolves multiple level-ups from one reward", () => {
    const result = applyReward({ level: 1, exp: 0, coins: 0, kills: 0 }, { exp: 250 });
    expect(result).toEqual({ level: 3, exp: 5, coins: 0, kills: 0, levelUps: 2 });
  });

  it("never exceeds the level cap", () => {
    const result = applyReward({ level: MAX_LEVEL, exp: 0, coins: 0, kills: 0 }, { exp: 1_000_000 });
    expect(result.level).toBe(MAX_LEVEL);
    expect(result.levelUps).toBe(0);
    expect(result.exp).toBe(nextExpForLevel(MAX_LEVEL));
  });

  it("levels all the way to the cap and stops there", () => {
    const result = applyReward(
      { level: 1, exp: 0, coins: 0, kills: 0 },
      { exp: 100_000_000 }
    );
    expect(result.level).toBe(MAX_LEVEL);
    expect(result.levelUps).toBe(MAX_LEVEL - 1);
    expect(result.exp).toBe(nextExpForLevel(MAX_LEVEL));
  });
});

describe("progressPayload", () => {
  it("pairs the ledger with its derived vitals", () => {
    expect(progressPayload({ level: 2, exp: 30, coins: 7, kills: 3 })).toEqual({
      level: 2,
      exp: 30,
      coins: 7,
      kills: 3,
      nextExp: 145,
      maxHp: 120,
      maxMp: 70
    });
  });
});
