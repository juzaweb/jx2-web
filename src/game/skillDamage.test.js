import { describe, it, expect } from "vitest";
import { skillMultiplier, computeSkillDamage, applyBuffsToStats } from "./skillDamage.js";
import { skillById } from "./skills.js";

const attacker = { attack: 24, critRate: 0, critDamage: 1.5 };
const defender = { defense: 6 };

describe("skillMultiplier", () => {
  it("returns the catalog multiplier for damaging skills", () => {
    expect(skillMultiplier(skillById("vi_da_quyen"))).toBe(1.7);
    expect(skillMultiplier(skillById("nhu_lai_than_thuong"))).toBe(2.4);
  });

  it("treats buff/heal skills as zero-damage", () => {
    expect(skillMultiplier(skillById("hue_nhan_chu"))).toBe(0);
    expect(skillMultiplier(null)).toBe(0);
  });
});

describe("computeSkillDamage", () => {
  it("scales mitigated damage by the skill multiplier", () => {
    // rng 0.5 -> no crit and neutral variance: (24 - 6) * 1.1 = 19.8 -> 20
    const result = computeSkillDamage(skillById("la_han_quyen"), attacker, defender, () => 0.5);
    expect(result.crit).toBe(false);
    expect(result.damage).toBe(20);
  });

  it("never yields damage for a non-damaging skill", () => {
    const result = computeSkillDamage(skillById("hue_nhan_chu"), attacker, defender, () => 0.5);
    expect(result.damage).toBe(0);
  });
});

describe("applyBuffsToStats", () => {
  const now = 1_000;
  const base = { attack: 100, defense: 50, critRate: 0.1 };

  it("applies percentage attack/defense and flat crit", () => {
    const buffed = applyBuffsToStats(base, [
      { stat: "attackPct", amount: 0.1, until: now + 100 },
      { stat: "defensePct", amount: 0.2, until: now + 100 },
      { stat: "critRate", amount: 0.15, until: now + 100 }
    ], now);
    expect(buffed.attack).toBe(110);
    expect(buffed.defense).toBe(60);
    expect(buffed.critRate).toBeCloseTo(0.25);
  });

  it("ignores expired buffs and does not mutate the input", () => {
    const buffed = applyBuffsToStats(base, [{ stat: "attackPct", amount: 0.5, until: now - 1 }], now);
    expect(buffed.attack).toBe(100);
    expect(base.attack).toBe(100);
  });
});
