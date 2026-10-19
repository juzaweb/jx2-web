import { describe, it, expect } from "vitest";
import { skillMpCost, SKILL_MP_COST } from "./skills.js";

describe("skillMpCost", () => {
  it("returns the configured cost for a known skill", () => {
    expect(skillMpCost("kiem_khi")).toBe(SKILL_MP_COST.kiem_khi);
    expect(skillMpCost("kiem_khi")).toBe(15);
  });

  it("treats unknown or missing skills as free", () => {
    expect(skillMpCost("normal")).toBe(0);
    expect(skillMpCost(undefined)).toBe(0);
    expect(skillMpCost("__proto__")).toBe(0);
  });
});
