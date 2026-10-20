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

  it("round-trips left/right slots per character", () => {
    saveSkillLoadout("char_1", { left: 3, right: 5 });
    expect(loadSkillLoadout("char_1")).toEqual({ left: 3, right: 5 });
    expect(loadSkillLoadout("char_2")).toEqual(DEFAULT_SKILL_LOADOUT);
  });

  it("clamps invalid slots and corrupt storage", () => {
    saveSkillLoadout("char_1", { left: -1, right: 99 });
    expect(loadSkillLoadout("char_1")).toEqual(DEFAULT_SKILL_LOADOUT);
    localStorage.setItem("jx2_skill_loadout_char_2", "{nope");
    expect(loadSkillLoadout("char_2")).toEqual(DEFAULT_SKILL_LOADOUT);
  });
});
