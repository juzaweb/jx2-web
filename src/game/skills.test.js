import { describe, it, expect } from "vitest";
import {
  SKILL_SLOTS,
  SKILLS,
  SKILLS_BY_SECT,
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
  it("keeps the four sects registered while Thiếu Lâm's palm kit is rebuilt", () => {
    expect(Object.keys(SKILLS_BY_SECT)).toEqual(["thieu-lam", "vo-dang", "nga-my", "ngu-doc"]);
    expect(SKILLS).toEqual([]);
    expect(SKILL_SLOTS).toBe(6);
  });

  it("returns an empty list for every sect with no authored kit", () => {
    expect(skillsForSect("thieu-lam")).toEqual([]);
    expect(skillsForSect("vo-dang")).toEqual([]);
    expect(skillsForSect("nga-my")).toEqual([]);
    expect(skillsForSect("ngu-doc")).toEqual([]);
  });

  it("normalises unknown sects to Thiếu Lâm", () => {
    expect(normalizeSect("bogus")).toBe("thieu-lam");
    expect(normalizeSect(undefined)).toBe("thieu-lam");
  });

  it("resolves unknown skills to empty results", () => {
    expect(skillById("la_han_quyen")).toBeUndefined();
    expect(skillForSlot("thieu-lam", 0)).toBeUndefined();
    expect(skillById("missing")).toBeUndefined();
    expect(skillSlot("missing")).toBe(-1);
  });

  it("reports MP cost and cooldown, treating unknown skills as free", () => {
    expect(skillMpCost("la_han_quyen")).toBe(0);
    expect(skillMpCost("normal")).toBe(0);
    expect(skillMpCost("__proto__")).toBe(0);
    expect(skillCooldown("la_han_quyen")).toBe(0);
    expect(skillCooldown("bogus")).toBe(0);
  });

  it("gates unknown skills by level", () => {
    expect(skillUnlocked("la_han_quyen", 1)).toBe(false);
    expect(skillUnlocked("bogus", 99)).toBe(false);
  });
});
