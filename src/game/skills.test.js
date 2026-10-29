import { describe, it, expect, vi } from "vitest";
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
  it("exposes the four sect kits and one starter per sect", () => {
    expect(Object.keys(SKILLS_BY_SECT)).toEqual(["thieu-lam", "vo-dang", "nga-my", "ngu-doc"]);
    expect(SKILLS.map((skill) => skill.id)).toEqual([
      "thieu_lam_tam_phap",
      "dai_tu_di_chuong",
      "la_han_quyen",
      "la_han_tran",
      "kim_cang_bat_hoai",
      "nhu_lai_than_chuong",
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

    // Every sect opens with exactly one starter art in slot 0.
    for (const [sect, kit] of Object.entries(SKILLS_BY_SECT)) {
      const starters = kit.filter((skill) => skill.starter === true);
      expect(starters, `${sect} starters`).toHaveLength(1);
      expect(starters[0].slot).toBe(0);
      expect(starters[0].unlockLevel).toBe(1);
    }

    expect(skillsForSect("vo-dang")[0]).toMatchObject({
      id: "thieu_duong_kiem_phap",
      weapon: "kiem",
      slot: 0,
      starter: true,
      unlockLevel: 1,
      range: 200,
      radius: 0,
      icon: "/skills/thieu_duong_kiem_phap.png",
      vfx: {
        sprite: "vfx-thieu-duong-kiem-phap",
        travelFrames: 1,
        impact: null,
        color: 0xffa726,
        fps: 12
      }
    });
    expect(skillsForSect("nga-my")[0]).toMatchObject({
      id: "nga_my_kiem_phap",
      weapon: "kiem",
      slot: 0,
      starter: true
    });

    const [tamPhap, daiTuDiChuong, laHanQuyen] = skillsForSect("thieu-lam");
    const laHanTran = skillsForSect("thieu-lam").find((skill) => skill.slot === 3);
    const kimCangBatHoai = skillsForSect("thieu-lam").find((skill) => skill.slot === 4);
    const nhuLaiThanChuong = skillsForSect("thieu-lam").find((skill) => skill.slot === 5);
    expect(tamPhap).toMatchObject({
      id: "thieu_lam_tam_phap",
      weapon: "bao-tay",
      slot: 0,
      icon: "/skills/thieu_lam_tam_phap.png",
      glyph: "心",
      starter: true,
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
      unlockLevel: 18,
      mp: 12,
      cooldown: 6000,
      range: 1200,
      radius: 0
    });
    expect(laHanQuyen).toMatchObject({
      id: "la_han_quyen",
      weapon: "bao-tay",
      slot: 2,
      icon: "/skills/la_han_quyen.png",
      glyph: "拳",
      unlockLevel: 10,
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
      unlockLevel: 26,
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
      unlockLevel: 34,
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
      unlockLevel: 50,
      mp: 35,
      cooldown: 30000,
      target: "enemy",
      range: 1200,
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
      "public/skills/vfx/nhu_lai_than_chuong/sheet.png",
      "public/skills/thieu_duong_kiem_phap.png",
      "public/skills/vfx/thieu_duong_kiem_phap/sheet.png"
    ]) {
      expect(fs.existsSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)))).toBe(true);
    }
  });

  it("returns the authored kit for each sect", () => {
    expect(skillsForSect("thieu-lam").length).toBe(6);
    expect(skillsForSect("vo-dang").length).toBe(4);
    expect(skillsForSect("nga-my").length).toBe(4);
    expect(skillsForSect("ngu-doc").length).toBe(4);
    // An unknown sect never borrows another sect's arts.
    expect(skillsForSect("bogus")).toEqual([]);
  });

  it("normalises unknown weapons to the sword type", () => {
    expect(normalizeWeaponType("bogus")).toBe("kiem");
    expect(normalizeWeaponType(undefined)).toBe("kiem");
  });

  it("resolves skills by id and slot", () => {
    expect(skillById("dai_tu_di_chuong")?.slot).toBe(1);
    expect(skillForSlot("thieu-lam", 1)?.id).toBe("dai_tu_di_chuong");
    expect(skillSlot("dai_tu_di_chuong")).toBe(1);
    expect(skillById("la_han_quyen")?.slot).toBe(2);
    expect(skillForSlot("thieu-lam", 2)?.id).toBe("la_han_quyen");
    expect(skillSlot("la_han_quyen")).toBe(2);
    expect(skillById("la_han_tran")?.slot).toBe(3);
    expect(skillForSlot("thieu-lam", 3)?.id).toBe("la_han_tran");
    expect(skillSlot("la_han_tran")).toBe(3);
    expect(skillById("kim_cang_bat_hoai")?.slot).toBe(4);
    expect(skillForSlot("thieu-lam", 4)?.id).toBe("kim_cang_bat_hoai");
    expect(skillSlot("kim_cang_bat_hoai")).toBe(4);
    expect(skillById("thieu_lam_tam_phap")?.slot).toBe(0);
    expect(skillForSlot("thieu-lam", 0)?.id).toBe("thieu_lam_tam_phap");
    expect(skillById("nhu_lai_than_chuong")?.slot).toBe(5);
    expect(skillForSlot("thieu-lam", 5)?.id).toBe("nhu_lai_than_chuong");
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
    // Each art of a school needs more character level than the one before it.
    expect(skillUnlocked("la_han_quyen", 10)).toBe(true);
    expect(skillUnlocked("la_han_quyen", 9)).toBe(false);
    expect(skillUnlocked("dai_tu_di_chuong", 18)).toBe(true);
    expect(skillUnlocked("dai_tu_di_chuong", 17)).toBe(false);
    expect(skillUnlocked("la_han_tran", 26)).toBe(true);
    expect(skillUnlocked("la_han_tran", 25)).toBe(false);
    expect(skillUnlocked("kim_cang_bat_hoai", 34)).toBe(true);
    expect(skillUnlocked("kim_cang_bat_hoai", 33)).toBe(false);
    expect(skillUnlocked("nhu_lai_than_chuong", 50)).toBe(true);
    expect(skillUnlocked("nhu_lai_than_chuong", 49)).toBe(false);
    expect(skillUnlocked("bogus", 99)).toBe(false);
  });

  it("declares prerequisites that exist inside the same sect kit", () => {
    expect(skillRequires("thieu_lam_tam_phap")).toEqual([]);
    expect(skillRequires("dai_tu_di_chuong")).toEqual([{ id: "thieu_lam_tam_phap", level: 1 }]);
    expect(skillRequires("la_han_quyen")).toEqual([]);
    expect(skillRequires("la_han_tran")).toEqual([{ id: "dai_tu_di_chuong", level: 1 }]);
    expect(skillRequires("kim_cang_bat_hoai")).toEqual([{ id: "la_han_tran", level: 1 }]);
    expect(skillRequires("nhu_lai_than_chuong")).toEqual([{ id: "la_han_tran", level: 1 }]);

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

  it("only knows the sect starter for free and studies the rest", () => {
    expect(skillLearned("thieu_duong_kiem_phap", [])).toBe(true);
    expect(skillLearned("thieu_lam_tam_phap", [])).toBe(true);
    expect(skillLearned("dai_tu_di_chuong", [])).toBe(false);
    expect(skillLearned("dai_tu_di_chuong", ["dai_tu_di_chuong"])).toBe(true);

    // Đại Tu Di Chưởng is the second fist art: level 18, once the internal art is known.
    expect(skillLearnable("dai_tu_di_chuong", 17, [])).toBe(false);
    expect(skillLearnable("dai_tu_di_chuong", 18, [])).toBe(true);
    // La Hán Quyền opens at the level-10 floor and needs no prerequisite.
    expect(skillLearnable("la_han_quyen", 9, [])).toBe(false);
    expect(skillLearnable("la_han_quyen", 10, [])).toBe(true);
    // Như Lai Thần Chưởng keeps its own, much higher requirement.
    expect(skillLearnable("nhu_lai_than_chuong", 9, ["dai_tu_di_chuong", "la_han_tran"])).toBe(
      false
    );
    expect(skillLearnable("nhu_lai_than_chuong", 50, ["dai_tu_di_chuong", "la_han_tran"])).toBe(
      true
    );

    // Casting requires the art to be learned (starters are free) and the
    // character to be at the art's own unlock level.
    expect(skillUsable("thieu_duong_kiem_phap", 1, [])).toBe(true);
    expect(skillUsable("dai_tu_di_chuong", 1, [])).toBe(false);
    expect(skillUsable("dai_tu_di_chuong", 10, ["dai_tu_di_chuong"])).toBe(false);
    expect(skillUsable("dai_tu_di_chuong", 18, ["dai_tu_di_chuong"])).toBe(true);
    expect(skillUsable("la_han_tran", 25, ["la_han_tran"])).toBe(false);
    expect(skillUsable("la_han_tran", 26, ["la_han_tran"])).toBe(true);
  });

  it("resolves prerequisites when unlocking a skill", () => {
    // tam_thanh_kiem_phap is the third sword art and also needs thai_cuc_quyen.
    expect(skillUnlocked("tam_thanh_kiem_phap", 25)).toBe(false);
    expect(skillUnlocked("tam_thanh_kiem_phap", 26)).toBe(true);

    const gated = { id: "synthetic", unlockLevel: 10, requires: [{ id: "dai_tu_di_chuong", level: 18 }] };
    expect(skillUnlocked(gated, 17)).toBe(false);
    expect(skillUnlocked(gated, 18)).toBe(true);

    const missing = { id: "synthetic", unlockLevel: 10, requires: [{ id: "nope", level: 1 }] };
    expect(skillUnlocked(missing, 10)).toBe(false);
  });

  it("explains why a skill is still locked", () => {
    expect(skillLockReason("dai_tu_di_chuong", 18)).toBeNull();
    expect(skillLockReason("dai_tu_di_chuong", 17)).toEqual({ kind: "level", level: 18 });
    expect(skillLockReason("thieu_lam_tam_phap", 9)).toBeNull();
    expect(skillLockReason("tam_thanh_kiem_phap", 1)).toEqual({ kind: "level", level: 26 });

    // Its own level is met, but the prerequisite needs a higher character level,
    // which is what the level-only gate reports.
    const gated = { id: "synthetic", unlockLevel: 10, requires: [{ id: "dai_tu_di_chuong", level: 34 }] };
    expect(skillLockReason(gated, 9)).toMatchObject({ kind: "level", level: 10 });
    expect(skillLockReason(gated, 12)).toMatchObject({
      kind: "prereq",
      id: "dai_tu_di_chuong",
      level: 34
    });
    // Once every prerequisite is reachable at that level, nothing is locked.
    expect(skillLockReason(gated, 34)).toBeNull();
  });

  it("applies the level-10 study floor even when an entry unlocks earlier", () => {
    // No authored skill sits below the floor today, so pin the rule with a
    // synthetic entry: a book must never be studied before character level 10.
    const early = { id: "synthetic_early", unlockLevel: 1, requires: [] };
    expect(skillLearnable(early, 9, [])).toBe(false);
    expect(skillLearnable(early, 10, [])).toBe(true);
    expect(skillLockReason(early, 9, [])).toEqual({ kind: "level", level: 10 });
    expect(skillLockReason(early, 10, [])).toEqual({ kind: "learn" });
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

  it("keeps book-free catalogs: every kit is complete and self-contained", () => {
    // No skill carries book metadata any more: studying happens in the F5 tree.
    for (const skill of SKILLS) expect(skill.book).toBeUndefined();

    // Every art belongs to exactly one sect kit and keeps that sect's weapon.
    for (const [sect, kit] of Object.entries(SKILLS_BY_SECT)) {
      for (const skill of kit) {
        expect(SKILLS.filter((entry) => entry.id === skill.id)).toHaveLength(1);
        expect(skill.slot).toBeGreaterThanOrEqual(0);
        expect(skill.slot).toBeLessThan(SKILL_SLOTS);
      }
    }
  });
});
