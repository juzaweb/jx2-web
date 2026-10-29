import { describe, it, expect } from "vitest";
import {
  DEFAULT_SECT,
  LEGACY_SECT,
  SECTS,
  SECT_IDS,
  isSectId,
  normalizeSect,
  sectForSkill,
  sectStarterSkillId,
  sectWeapon,
  sectWeaponItemId
} from "./sects.js";
import { SKILL_KITS } from "./skills.js";
import { WEAPON_TYPES } from "./weapons.js";
import { getItemById } from "./items.js";

describe("sect catalog", () => {
  it("declares the four martial sects in catalog order", () => {
    expect(SECT_IDS).toEqual(["thieu-lam", "vo-dang", "nga-my", "ngu-doc"]);
    expect(Object.keys(SECTS)).toEqual(SECT_IDS);
  });

  it("pairs every sect with a real weapon, starter art and starting weapon", () => {
    for (const id of SECT_IDS) {
      const sect = SECTS[id];
      expect(sect.id).toBe(id);
      expect(WEAPON_TYPES).toContain(sect.weapon);
      expect(sect.nameKey).toBeTruthy();
      expect(sect.descKey).toBeTruthy();

      // The starter art exists in that sect's kit and sits in slot 0.
      const starter = SKILL_KITS[id].find((skill) => skill.id === sect.starterSkillId);
      expect(starter, `${id} starter`).toBeTruthy();
      expect(starter.slot).toBe(0);
      expect(starter.starter).toBe(true);
      expect(starter.weapon).toBe(sect.weapon);

      // The starting weapon is a real weapon of that type.
      const weapon = getItemById(sect.weaponItemId);
      expect(weapon, `${id} weapon item`).toBeTruthy();
      expect(weapon.slot).toBe("weapon");
      expect(weapon.weaponType).toBe(sect.weapon);
    }
  });

  it("resolves helpers and normalises unknown or legacy ids", () => {
    expect(normalizeSect("thieu-lam")).toBe("thieu-lam");
    expect(normalizeSect(LEGACY_SECT)).toBe(DEFAULT_SECT);
    expect(normalizeSect("ma-giao")).toBe(DEFAULT_SECT);
    expect(normalizeSect(null)).toBe(DEFAULT_SECT);
    expect(isSectId("nga-my")).toBe(true);
    expect(isSectId("none")).toBe(false);

    expect(sectWeapon("ngu-doc")).toBe("dao");
    expect(sectStarterSkillId("ngu-doc")).toBe("ngu_doc_tam_phap");
    expect(sectWeaponItemId("thieu-lam")).toBe("bao-tay-lang-khach");
  });

  it("maps a skill id back to the sect that owns it", () => {
    expect(sectForSkill("la_han_quyen", SKILL_KITS)).toBe("thieu-lam");
    expect(sectForSkill("toat_hong_quan_khuyet", SKILL_KITS)).toBe("vo-dang");
    expect(sectForSkill("luu_thuy_khanh_van", SKILL_KITS)).toBe("nga-my");
    expect(sectForSkill("truy_tam_doc", SKILL_KITS)).toBe("ngu-doc");
    // Retired ids belong to no kit.
    expect(sectForSkill("kiem_khi", SKILL_KITS)).toBeNull();
    expect(sectForSkill(null, SKILL_KITS)).toBeNull();
  });
});
