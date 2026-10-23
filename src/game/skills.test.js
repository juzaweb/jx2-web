import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { translateFor } from "../i18n/translator.js";
import {
  SKILL_SLOTS,
  SKILLS,
  SKILLS_BY_SECT,
  skillsForSect,
  skillById,
  skillForSlot,
  skillMpCost,
  skillCooldown,
  skillRequires,
  skillLockReason,
  skillUnlocked,
  skillSlot,
  normalizeSect
} from "./skills.js";

describe("skill catalog", () => {
  it("exposes the Thiếu Lâm palm skills", () => {
    expect(Object.keys(SKILLS_BY_SECT)).toEqual(["thieu-lam", "vo-dang", "nga-my", "ngu-doc"]);
    expect(SKILLS.map((skill) => skill.id)).toEqual([
      "la_han_quyen",
      "thieu_lam_truong_phap",
      "dai_tu_di_chuong",
      "la_han_tran",
      "thieu_duong_kiem_phap",
      "thai_cuc_quyen",
      "tam_thanh_kiem_phap",
      "toat_hong_quan_khuyet",
      "nga_my_kiem_phap",
      "mong_diep_thoi_tam",
      "tu_hang_pho_do",
      "luu_thuy_khanh_van",
      "ngu_doc_tam_phap",
      "truy_tam_doc",
      "van_doc_chieu_hong",
      "u_hong_phiet_anh"
    ]);
    expect(SKILL_SLOTS).toBe(6);

    const [laHanQuyen, thieuLamTruongPhap, daiTuDiChuong, laHanTran] = skillsForSect("thieu-lam");
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
      "public/skills/la_han_quyen.png",
      "public/skills/thieu_lam_truong_phap.png",
      "public/skills/dai_tu_di_chuong.png",
      "public/skills/vfx/dai_tu_di_chuong/sheet.png",
      "public/skills/la_han_tran.png",
      "public/skills/vfx/la_han_tran/sheet.png"
    ]) {
      expect(fs.existsSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)))).toBe(true);
    }
  });

  it("returns authored kit for all valid sects", () => {
    expect(skillsForSect("vo-dang").length).toBe(4);
    expect(skillsForSect("nga-my").length).toBe(4);
    expect(skillsForSect("ngu-doc").length).toBe(4);
  });

  it("normalises unknown sects to Thiếu Lâm", () => {
    expect(normalizeSect("bogus")).toBe("thieu-lam");
    expect(normalizeSect(undefined)).toBe("thieu-lam");
  });

  it("resolves skills by id and slot", () => {
    expect(skillById("dai_tu_di_chuong")?.slot).toBe(2);
    expect(skillForSlot("thieu-lam", 2)?.id).toBe("dai_tu_di_chuong");
    expect(skillSlot("dai_tu_di_chuong")).toBe(2);
    expect(skillById("la_han_tran")?.slot).toBe(3);
    expect(skillForSlot("thieu-lam", 3)?.id).toBe("la_han_tran");
    expect(skillSlot("la_han_tran")).toBe(3);
    expect(skillById("la_han_quyen")?.slot).toBe(0);
    expect(skillForSlot("thieu-lam", 0)?.id).toBe("la_han_quyen");
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

  it("declares prerequisites that exist inside the same sect", () => {
    expect(skillRequires("la_han_quyen")).toEqual([]);
    expect(skillRequires("la_han_tran")).toEqual([{ id: "dai_tu_di_chuong", level: 1 }]);

    for (const sect of Object.keys(SKILLS_BY_SECT)) {
      const ids = new Set(skillsForSect(sect).map((skill) => skill.id));
      for (const skill of skillsForSect(sect)) {
        for (const req of skillRequires(skill)) {
          expect(ids.has(req.id), `${skill.id} requires ${req.id} outside ${sect}`).toBe(true);
          expect(Number.isInteger(req.level)).toBe(true);
          expect(req.level).toBeGreaterThan(0);
        }
      }
    }
  });

  it("resolves prerequisites when unlocking a skill", () => {
    // tam_thanh_kiem_phap needs level 2 and also its prerequisite thai_cuc_quyen.
    expect(skillUnlocked("tam_thanh_kiem_phap", 1)).toBe(false);
    expect(skillUnlocked("tam_thanh_kiem_phap", 2)).toBe(true);

    const gated = { id: "synthetic", unlockLevel: 1, requires: [{ id: "dai_tu_di_chuong", level: 5 }] };
    expect(skillUnlocked(gated, 4)).toBe(false);
    expect(skillUnlocked(gated, 5)).toBe(true);

    const missing = { id: "synthetic", unlockLevel: 1, requires: [{ id: "nope", level: 1 }] };
    expect(skillUnlocked(missing, 10)).toBe(false);
  });

  it("explains why a skill is still locked", () => {
    expect(skillLockReason("la_han_quyen", 1)).toBeNull();
    expect(skillLockReason("tam_thanh_kiem_phap", 1)).toEqual({ kind: "level", level: 2 });

    const gated = { id: "synthetic", unlockLevel: 1, requires: [{ id: "dai_tu_di_chuong", level: 5 }] };
    expect(skillLockReason(gated, 4)).toMatchObject({
      kind: "prereq",
      id: "dai_tu_di_chuong",
      level: 5
    });
    expect(skillLockReason(gated, 5)).toBeNull();
  });

  it("has valid name and description in all locales for every skill", () => {
    for (const skill of SKILLS) {
      for (const lang of ["vi", "en", "zh"]) {
        const name = translateFor(lang, skill.nameKey, undefined, null);
        const desc = translateFor(lang, skill.descKey, undefined, null);
        expect(name, `Missing name for ${skill.id} in ${lang}`).toBeTruthy();
        expect(desc, `Missing desc for ${skill.id} in ${lang}`).toBeTruthy();
        expect(name).not.toBe(skill.id);
        expect(name).not.toBe(skill.nameKey);
      }
    }
  });
});
