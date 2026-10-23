// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_SKILL_LOADOUT,
  loadSkillLoadout,
  saveSkillLoadout
} from "./skillLoadout.js";

describe("skill loadout", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults for a new character", () => {
    expect(loadSkillLoadout("char_1")).toEqual(DEFAULT_SKILL_LOADOUT);
  });

  it("round-trips UIOP skill slots per character", () => {
    saveSkillLoadout("char_1", { u: 2, i: 3, o: 4, p: 5 });
    expect(loadSkillLoadout("char_1")).toEqual({
      u: 2,
      i: 3,
      o: 4,
      p: 5,
      left: 2,
      right: 3
    });
    expect(loadSkillLoadout("char_2")).toEqual(DEFAULT_SKILL_LOADOUT);
  });

  it("migrates legacy left/right loadouts cleanly", () => {
    localStorage.setItem("jx2_skill_loadout_legacy", JSON.stringify({ left: 3, right: 5 }));
    expect(loadSkillLoadout("legacy")).toEqual({
      u: 3,
      i: 5,
      o: 2,
      p: 3,
      left: 3,
      right: 5
    });
  });

  it("clamps invalid slots and corrupt storage", () => {
    saveSkillLoadout("char_1", { u: -1, i: 99, o: -5, p: 100 });
    expect(loadSkillLoadout("char_1")).toEqual(DEFAULT_SKILL_LOADOUT);
    localStorage.setItem("jx2_skill_loadout_char_2", "{nope");
    expect(loadSkillLoadout("char_2")).toEqual(DEFAULT_SKILL_LOADOUT);
  });
});
