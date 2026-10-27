import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { translateFor } from "../i18n/translator.js";
import { BOOK_ITEMS } from "./items.js";
import { MONSTER_BOOK_DROPS } from "./enemyCatalog.js";
import {
  SKILL_SLOTS,
  SKILLS,
  SKILLS_BY_WEAPON,
  skillsForWeapon,
  skillById,
  skillForSlot,
  skillMpCost,
  skillCooldown,
  effectiveSkillMpCost,
  effectiveSkillCooldown,
  skillRequires,
  skillLockReason,
  skillUnlocked,
  skillLearned,
  skillLearnable,
  skillUsable,
  skillSlot,
  normalizeWeaponType
} from "./skills.js";

describe("skill catalog", () => {
  it("exposes the weapon kits and the starter sword skill", () => {
    expect(Object.keys(SKILLS_BY_WEAPON)).toEqual(["bao-tay", "kiem", "dao"]);
    expect(SKILLS.map((skill) => skill.id)).toEqual([
      "thieu_lam_tam_phap",
      "dai_tu_di_chuong",
      "la_han_quyen",
      "la_han_tran",
      "kim_cang_bat_hoai",
      "nhu_lai_than_chuong",
      "kiem_khi",
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

    expect(skillsForWeapon("kiem")[0]).toMatchObject({
      id: "kiem_khi",
      weapon: "kiem",
      slot: 0,
      starter: true,
      unlockLevel: 1
    });

    const [tamPhap, daiTuDiChuong, laHanQuyen] = skillsForWeapon("bao-tay");
    const laHanTran = skillsForWeapon("bao-tay").find((skill) => skill.slot === 3);
    const kimCangBatHoai = skillsForWeapon("bao-tay").find((skill) => skill.slot === 4);
    const nhuLaiThanChuong = skillsForWeapon("bao-tay").find((skill) => skill.slot === 5);
    expect(tamPhap).toMatchObject({
      id: "thieu_lam_tam_phap",
      weapon: "bao-tay",
      slot: 0,
      icon: "/skills/thieu_lam_tam_phap.png",
      glyph: "心",
      unlockLevel: 1,
      mp: 0,
      cooldown: 0,
      target: "self",
      range: 0,
      radius: 0,
      mult: 0,
      passive: true,
      effects: [{ kind: "regen", hpPerSecond: 2 }]
    });
    expect(daiTuDiChuong).toMatchObject({
      id: "dai_tu_di_chuong",
      weapon: "bao-tay",
      slot: 1,
      unlockLevel: 1,
      mp: 12,
      cooldown: 6000,
      range: 6000,
      radius: 0
    });
    expect(laHanQuyen).toMatchObject({
      id: "la_han_quyen",
      weapon: "bao-tay",
      slot: 2,
      icon: "/skills/la_han_quyen.png",
      glyph: "拳",
      unlockLevel: 1,
      mp: 20,
      cooldown: 8000,
      target: "enemy",
      range: 300,
      radius: 0,
      mult: 0.22,
      channel: { durationMs: 5000, intervalMs: 250 },
      splash: { radius: 160, mult: 0.6, maxTargets: 4 },
      effects: [{ kind: "stun", duration: 600, chance: 0.1 }]
    });
    expect(laHanTran).toMatchObject({
      id: "la_han_tran",
      weapon: "bao-tay",
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
    expect(kimCangBatHoai).toMatchObject({
      id: "kim_cang_bat_hoai",
      weapon: "bao-tay",
      slot: 4,
      icon: "/skills/kim_cang_bat_hoai.png",
      glyph: "卍",
      unlockLevel: 1,
      mp: 20,
      cooldown: 18000,
      target: "self",
      range: 0,
      radius: 0,
      mult: 0,
      effects: [{ kind: "buff", stat: "defensePct", amount: 0.3, duration: 30000 }],
      vfx: {
        type: "overhead",
        overhead: "buff-phat-an",
        overheadScale: 0.05,
        overheadOffsetY: -80
      }
    });
    expect(nhuLaiThanChuong).toMatchObject({
      id: "nhu_lai_than_chuong",
      weapon: "bao-tay",
      slot: 5,
      unlockLevel: 10,
      mp: 35,
      cooldown: 30000,
      target: "enemy",
      range: 6000,
      radius: 900,
      mult: 2.4,
      effects: [{ kind: "stun", duration: 1200 }],
      vfx: {
        sprite: "vfx-nhu-lai-than-chuong",
        type: "slam",
        impact: null,
        size: 800,
        castScale: 0.4,
        impactScale: 1.5
      }
    });
  });

  it("ships the palm icon and VFX sheet", () => {
    for (const file of [
      "public/skills/thieu_lam_tam_phap.png",
      "public/skills/dai_tu_di_chuong.png",
      "public/skills/vfx/dai_tu_di_chuong/sheet.png",
      "public/skills/la_han_tran.png",
      "public/skills/vfx/la_han_tran/sheet.png",
      "public/skills/kim_cang_bat_hoai.png",
      "public/skills/nhu_lai_than_chuong.png",
      "public/skills/vfx/nhu_lai_than_chuong/sheet.png"
    ]) {
      expect(fs.existsSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)))).toBe(true);
    }
  });

  it("returns authored kit for all valid weapons", () => {
    expect(skillsForWeapon("bao-tay").length).toBe(6);
    expect(skillsForWeapon("kiem").length).toBe(9);
    expect(skillsForWeapon("dao").length).toBe(4);
  });

  it("normalises unknown weapons to the sword kit", () => {
    expect(normalizeWeaponType("bogus")).toBe("kiem");
    expect(normalizeWeaponType(undefined)).toBe("kiem");
  });

  it("resolves skills by id and slot", () => {
    expect(skillById("dai_tu_di_chuong")?.slot).toBe(1);
    expect(skillForSlot("bao-tay", 1)?.id).toBe("dai_tu_di_chuong");
    expect(skillSlot("dai_tu_di_chuong")).toBe(1);
    expect(skillById("la_han_quyen")?.slot).toBe(2);
    expect(skillForSlot("bao-tay", 2)?.id).toBe("la_han_quyen");
    expect(skillSlot("la_han_quyen")).toBe(2);
    expect(skillById("la_han_tran")?.slot).toBe(3);
    expect(skillForSlot("bao-tay", 3)?.id).toBe("la_han_tran");
    expect(skillSlot("la_han_tran")).toBe(3);
    expect(skillById("kim_cang_bat_hoai")?.slot).toBe(4);
    expect(skillForSlot("bao-tay", 4)?.id).toBe("kim_cang_bat_hoai");
    expect(skillSlot("kim_cang_bat_hoai")).toBe(4);
    expect(skillById("thieu_lam_tam_phap")?.slot).toBe(0);
    expect(skillForSlot("bao-tay", 0)?.id).toBe("thieu_lam_tam_phap");
    expect(skillById("nhu_lai_than_chuong")?.slot).toBe(5);
    expect(skillForSlot("bao-tay", 5)?.id).toBe("nhu_lai_than_chuong");
    expect(skillSlot("nhu_lai_than_chuong")).toBe(5);
    expect(skillById("missing")).toBeUndefined();
    expect(skillSlot("missing")).toBe(-1);
  });

  it("reports MP cost and cooldown, treating unknown skills as free", () => {
    expect(skillMpCost("thieu_lam_tam_phap")).toBe(0);
    expect(skillCooldown("thieu_lam_tam_phap")).toBe(0);
    expect(skillMpCost("dai_tu_di_chuong")).toBe(12);
    expect(skillCooldown("dai_tu_di_chuong")).toBe(6000);
    expect(skillMpCost("la_han_quyen")).toBe(20);
    expect(skillCooldown("la_han_quyen")).toBe(8000);
    expect(skillMpCost("la_han_tran")).toBe(18);
    expect(skillCooldown("la_han_tran")).toBe(9000);
    expect(skillMpCost("kim_cang_bat_hoai")).toBe(20);
    expect(skillCooldown("kim_cang_bat_hoai")).toBe(18000);
    expect(skillMpCost("nhu_lai_than_chuong")).toBe(35);
    expect(skillCooldown("nhu_lai_than_chuong")).toBe(30000);
    expect(skillMpCost("normal")).toBe(0);
    expect(skillMpCost("__proto__")).toBe(0);
    expect(skillCooldown("bogus")).toBe(0);
  });

  it("keeps the catalog costs in normal play", () => {
    vi.stubEnv("VITE_TEST_MODE", "false");
    try {
      expect(effectiveSkillMpCost("nhu_lai_than_chuong")).toBe(35);
      expect(effectiveSkillCooldown("nhu_lai_than_chuong")).toBe(30000);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("waives both casting costs in test mode", () => {
    vi.stubEnv("VITE_TEST_MODE", "true");
    try {
      expect(effectiveSkillMpCost("nhu_lai_than_chuong")).toBe(0);
      expect(effectiveSkillCooldown("nhu_lai_than_chuong")).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("gates skills by level", () => {
    expect(skillUnlocked("dai_tu_di_chuong", 1)).toBe(true);
    expect(skillUnlocked("dai_tu_di_chuong", 0)).toBe(false);
    expect(skillUnlocked("la_han_quyen", 1)).toBe(true);
    expect(skillUnlocked("la_han_quyen", 0)).toBe(false);
    expect(skillUnlocked("la_han_tran", 1)).toBe(true);
    expect(skillUnlocked("la_han_tran", 0)).toBe(false);
    expect(skillUnlocked("kim_cang_bat_hoai", 1)).toBe(true);
    expect(skillUnlocked("kim_cang_bat_hoai", 0)).toBe(false);
    expect(skillUnlocked("nhu_lai_than_chuong", 10)).toBe(true);
    expect(skillUnlocked("nhu_lai_than_chuong", 9)).toBe(false);
    expect(skillUnlocked("bogus", 99)).toBe(false);
  });

  it("declares prerequisites that exist inside the same weapon kit", () => {
    expect(skillRequires("thieu_lam_tam_phap")).toEqual([]);
    expect(skillRequires("dai_tu_di_chuong")).toEqual([{ id: "thieu_lam_tam_phap", level: 1 }]);
    expect(skillRequires("la_han_quyen")).toEqual([]);
    expect(skillRequires("la_han_tran")).toEqual([{ id: "dai_tu_di_chuong", level: 1 }]);
    expect(skillRequires("kim_cang_bat_hoai")).toEqual([{ id: "la_han_tran", level: 1 }]);
    expect(skillRequires("nhu_lai_than_chuong")).toEqual([{ id: "la_han_tran", level: 1 }]);

    for (const weapon of Object.keys(SKILLS_BY_WEAPON)) {
      const ids = new Set(skillsForWeapon(weapon).map((skill) => skill.id));
      for (const skill of skillsForWeapon(weapon)) {
        for (const req of skillRequires(skill)) {
          expect(ids.has(req.id), `${skill.id} requires ${req.id} outside ${weapon}`).toBe(true);
          expect(Number.isInteger(req.level)).toBe(true);
          expect(req.level).toBeGreaterThan(0);
        }
      }
    }
  });

  it("only knows starter skills for free and learns the rest from books", () => {
    expect(skillLearned("kiem_khi", [])).toBe(true);
    expect(skillLearned("dai_tu_di_chuong", [])).toBe(false);
    expect(skillLearned("dai_tu_di_chuong", ["dai_tu_di_chuong"])).toBe(true);

    // Without the prerequisite learned, a book cannot be studied.
    expect(skillLearnable("dai_tu_di_chuong", 1, [])).toBe(false);
    expect(skillLearnable("dai_tu_di_chuong", 1, ["thieu_lam_tam_phap"])).toBe(true);
    expect(skillLearnable("nhu_lai_than_chuong", 9, ["dai_tu_di_chuong", "la_han_tran"])).toBe(
      false
    );

    // Casting requires the skill to be learned (starter skills are free).
    expect(skillUsable("kiem_khi", 1, [])).toBe(true);
    expect(skillUsable("dai_tu_di_chuong", 1, [])).toBe(false);
    expect(skillUsable("dai_tu_di_chuong", 1, ["dai_tu_di_chuong"])).toBe(true);
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
    expect(skillLockReason("thieu_lam_tam_phap", 1)).toBeNull();
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

  it("gives every learnable skill a book that a monster actually drops", () => {
    const learnable = SKILLS.filter((skill) => !skill.starter).map((skill) => skill.id);
    const bookSkillIds = new Set(BOOK_ITEMS.map((book) => book.skillId));
    const droppedSkillIds = new Set(
      Object.values(MONSTER_BOOK_DROPS).flatMap((group) => group.skills)
    );

    for (const skillId of learnable) {
      expect(bookSkillIds.has(skillId), `Missing book for ${skillId}`).toBe(true);
      expect(droppedSkillIds.has(skillId), `No monster drops the ${skillId} book`).toBe(true);
    }
    // Starter skills are never book items.
    for (const skill of SKILLS.filter((entry) => entry.starter)) {
      expect(bookSkillIds.has(skill.id)).toBe(false);
    }
    // Every drop pool names a real, learnable skill.
    for (const skillId of droppedSkillIds) {
      expect(learnable).toContain(skillId);
    }
  });
});
