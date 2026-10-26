// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_MOBILE_SKILLS,
  MOBILE_SKILL_SLOTS,
  sanitizeMobileSkills,
  loadMobileSkills,
  saveMobileSkills,
  assignMobileSkill
} from "./mobileSkills.js";

describe("mobileSkills", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults every arc button to empty", () => {
    expect(loadMobileSkills("char1")).toEqual(DEFAULT_MOBILE_SKILLS);
    expect(DEFAULT_MOBILE_SKILLS).toHaveLength(MOBILE_SKILL_SLOTS);
  });

  it("sanitizes raw input into a fixed-length array", () => {
    expect(sanitizeMobileSkills(null)).toEqual(DEFAULT_MOBILE_SKILLS);
    expect(sanitizeMobileSkills(["dai_tu_di_chuong", "", 7])).toEqual([
      "dai_tu_di_chuong",
      null,
      null,
      null
    ]);
  });

  it("assigns and clears one button per character", () => {
    let skills = assignMobileSkill("char1", [], 1, "la_han_tran");
    expect(skills[1]).toBe("la_han_tran");
    expect(loadMobileSkills("char1")[1]).toBe("la_han_tran");

    skills = assignMobileSkill("char1", skills, 1, null);
    expect(skills[1]).toBeNull();

    expect(loadMobileSkills("char2")).toEqual(DEFAULT_MOBILE_SKILLS);
  });

  it("ignores out-of-range indexes", () => {
    const skills = assignMobileSkill("char1", [], 9, "la_han_tran");
    expect(skills).toEqual(DEFAULT_MOBILE_SKILLS);
  });

  it("round-trips through storage", () => {
    const saved = saveMobileSkills("char1", ["a", "b", null, "d"]);
    expect(loadMobileSkills("char1")).toEqual(saved);
    expect(saved).toEqual(["a", "b", null, "d"]);
  });
});
