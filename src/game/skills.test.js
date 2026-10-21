import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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
  it("exposes the first Thiếu Lâm palm skill", () => {
    expect(Object.keys(SKILLS_BY_SECT)).toEqual(["thieu-lam", "vo-dang", "nga-my", "ngu-doc"]);
    expect(SKILLS.map((skill) => skill.id)).toEqual(["dai_tu_di_chuong"]);
    expect(SKILL_SLOTS).toBe(6);

    const [skill] = skillsForSect("thieu-lam");
    expect(skill).toMatchObject({
      id: "dai_tu_di_chuong",
      sect: "thieu-lam",
      slot: 2,
      unlockLevel: 1,
      mp: 12,
      cooldown: 6000,
      radius: 110
    });
  });

  it("ships the palm icon and VFX sheet", () => {
    for (const file of [
      "public/skills/dai_tu_di_chuong.png",
      "public/skills/vfx/dai_tu_di_chuong/sheet.png"
    ]) {
      expect(fs.existsSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)))).toBe(true);
    }
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

  it("resolves skills by id and slot, and removed TLQ ids to nothing", () => {
    expect(skillById("dai_tu_di_chuong")?.slot).toBe(2);
    expect(skillForSlot("thieu-lam", 2)?.id).toBe("dai_tu_di_chuong");
    expect(skillSlot("dai_tu_di_chuong")).toBe(2);
    expect(skillById("la_han_quyen")).toBeUndefined();
    expect(skillForSlot("thieu-lam", 0)).toBeUndefined();
    expect(skillById("missing")).toBeUndefined();
    expect(skillSlot("missing")).toBe(-1);
  });

  it("reports MP cost and cooldown, treating unknown skills as free", () => {
    expect(skillMpCost("dai_tu_di_chuong")).toBe(12);
    expect(skillCooldown("dai_tu_di_chuong")).toBe(6000);
    expect(skillMpCost("normal")).toBe(0);
    expect(skillMpCost("__proto__")).toBe(0);
    expect(skillCooldown("bogus")).toBe(0);
  });

  it("gates skills by level", () => {
    expect(skillUnlocked("dai_tu_di_chuong", 1)).toBe(true);
    expect(skillUnlocked("dai_tu_di_chuong", 0)).toBe(false);
    expect(skillUnlocked("bogus", 99)).toBe(false);
  });
});
