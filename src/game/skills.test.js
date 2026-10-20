import { describe, it, expect } from "vitest";
import {
  SKILL_SLOTS,
  SKILLS,
  skillsForSect,
  skillById,
  skillForSlot,
  skillMpCost,
  skillCooldown,
  skillUnlocked,
  skillSlot,
  normalizeSect
} from "./skills.js";

describe("skill catalog", () => {
  it("exposes exactly one skill per slot for Thiếu Lâm", () => {
    const skills = skillsForSect("thieu-lam");
    expect(skills).toHaveLength(SKILL_SLOTS);
    expect(new Set(skills.map((skill) => skill.slot))).toEqual(
      new Set([0, 1, 2, 3, 4, 5])
    );
    expect(new Set(SKILLS.map((skill) => skill.id)).size).toBe(SKILLS.length);
  });

  it("returns an empty list for sects without an authored kit", () => {
    expect(skillsForSect("vo-dang")).toEqual([]);
    expect(skillsForSect("nga-my")).toEqual([]);
    expect(skillsForSect("ngu-doc")).toEqual([]);
  });

  it("normalises unknown sects to Thiếu Lâm", () => {
    expect(normalizeSect("bogus")).toBe("thieu-lam");
    expect(normalizeSect(undefined)).toBe("thieu-lam");
  });

  it("resolves skills by id and slot", () => {
    expect(skillById("la_han_quyen")?.slot).toBe(0);
    expect(skillForSlot("thieu-lam", 5)?.id).toBe("nhu_lai_than_thuong");
    expect(skillSlot("dai_tu_di_chuong")).toBe(3);
    expect(skillById("missing")).toBeUndefined();
    expect(skillSlot("missing")).toBe(-1);
  });

  it("reports MP cost and cooldown, treating unknown skills as free", () => {
    expect(skillMpCost("la_han_quyen")).toBe(5);
    expect(skillMpCost("nhu_lai_than_thuong")).toBe(35);
    expect(skillMpCost("normal")).toBe(0);
    expect(skillMpCost("__proto__")).toBe(0);
    expect(skillCooldown("la_han_quyen")).toBe(1500);
    expect(skillCooldown("bogus")).toBe(0);
  });

  it("gates skills by level", () => {
    expect(skillUnlocked("la_han_quyen", 1)).toBe(true);
    expect(skillUnlocked("nhu_lai_than_thuong", 9)).toBe(false);
    expect(skillUnlocked("nhu_lai_than_thuong", 10)).toBe(true);
    expect(skillUnlocked("bogus", 99)).toBe(false);
  });
});
