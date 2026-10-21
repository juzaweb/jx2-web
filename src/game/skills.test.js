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
  it("exposes the Thiếu Lâm palm skills", () => {
    expect(Object.keys(SKILLS_BY_SECT)).toEqual(["thieu-lam", "vo-dang", "nga-my", "ngu-doc"]);
    expect(SKILLS.map((skill) => skill.id)).toEqual(["dai_tu_di_chuong", "la_han_tran"]);
    expect(SKILL_SLOTS).toBe(6);

    const [daiTuDiChuong, laHanTran] = skillsForSect("thieu-lam");
    expect(daiTuDiChuong).toMatchObject({
      id: "dai_tu_di_chuong",
      sect: "thieu-lam",
      slot: 2,
      unlockLevel: 1,
      mp: 12,
      cooldown: 6000,
      range: 6000,
      radius: 0
    });
    expect(laHanTran).toMatchObject({
      id: "la_han_tran",
      sect: "thieu-lam",
      slot: 3,
      unlockLevel: 1,
      mp: 18,
      cooldown: 9000,
      target: "self",
      range: 0,
      radius: 0,
      mult: 0,
      effects: [
        { kind: "buff", stat: "attackPct", amount: 0.1, duration: 180000 },
        { kind: "buff", stat: "speedPct", amount: 0.2, duration: 180000 },
        { kind: "buff", stat: "critRate", amount: 0.05, duration: 180000 }
      ]
    });
  });

  it("ships the palm icon and VFX sheet", () => {
    for (const file of [
      "public/skills/dai_tu_di_chuong.png",
      "public/skills/vfx/dai_tu_di_chuong/sheet.png",
      "public/skills/la_han_tran.png",
      "public/skills/vfx/la_han_tran/sheet.png"
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
    expect(skillById("la_han_tran")?.slot).toBe(3);
    expect(skillForSlot("thieu-lam", 3)?.id).toBe("la_han_tran");
    expect(skillSlot("la_han_tran")).toBe(3);
    expect(skillById("la_han_quyen")).toBeUndefined();
    expect(skillForSlot("thieu-lam", 0)).toBeUndefined();
    expect(skillById("missing")).toBeUndefined();
    expect(skillSlot("missing")).toBe(-1);
  });

  it("reports MP cost and cooldown, treating unknown skills as free", () => {
    expect(skillMpCost("dai_tu_di_chuong")).toBe(12);
    expect(skillCooldown("dai_tu_di_chuong")).toBe(6000);
    expect(skillMpCost("la_han_tran")).toBe(18);
    expect(skillCooldown("la_han_tran")).toBe(9000);
    expect(skillMpCost("normal")).toBe(0);
    expect(skillMpCost("__proto__")).toBe(0);
    expect(skillCooldown("bogus")).toBe(0);
  });

  it("gates skills by level", () => {
    expect(skillUnlocked("dai_tu_di_chuong", 1)).toBe(true);
    expect(skillUnlocked("dai_tu_di_chuong", 0)).toBe(false);
    expect(skillUnlocked("la_han_tran", 1)).toBe(true);
    expect(skillUnlocked("la_han_tran", 0)).toBe(false);
    expect(skillUnlocked("bogus", 99)).toBe(false);
  });
});
