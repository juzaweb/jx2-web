// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_SKILL_BINDS,
  normalizeKey,
  isReservedKey,
  defaultSkillBinds,
  loadSkillBinds,
  saveSkillBinds,
  setSkillBind,
  keyToSlot
} from "./keybinds.js";

describe("skill keybinds", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exposes six default binds", () => {
    expect(defaultSkillBinds()).toEqual(DEFAULT_SKILL_BINDS);
    expect(DEFAULT_SKILL_BINDS).toHaveLength(6);
  });

  it("normalises keyboard events and raw strings", () => {
    expect(normalizeKey({ key: "Q" })).toBe("q");
    expect(normalizeKey({ key: " " })).toBe("space");
    expect(normalizeKey("ArrowUp")).toBe("arrowup");
    expect(normalizeKey("")).toBe("");
  });

  it("reserves UI-owned keys", () => {
    expect(isReservedKey("escape")).toBe(true);
    expect(isReservedKey("f4")).toBe(true);
    expect(isReservedKey("space")).toBe(false);
    expect(isReservedKey("p")).toBe(false);
  });

  it("round-trips bindings per character", () => {
    const binds = ["q", "z", "x", "c", "v", "b"];
    saveSkillBinds("char_1", binds);
    expect(loadSkillBinds("char_1")).toEqual(binds);
    // Another character keeps the defaults.
    expect(loadSkillBinds("char_2")).toEqual(DEFAULT_SKILL_BINDS);
  });

  it("falls back to defaults on corrupt storage", () => {
    localStorage.setItem("jx2_skill_binds_char_1", "{nope");
    expect(loadSkillBinds("char_1")).toEqual(DEFAULT_SKILL_BINDS);
  });

  it("rejects reserved, empty, and duplicate keys", () => {
    const binds = defaultSkillBinds();
    expect(setSkillBind(binds, 0, "escape").error).toBe("reserved");
    expect(setSkillBind(binds, 0, "").error).toBe("empty");
    expect(setSkillBind(binds, 0, "w").error).toBe("duplicate");
    const ok = setSkillBind(binds, 0, "z");
    expect(ok.ok).toBe(true);
    expect(ok.binds[0]).toBe("z");
    expect(binds[0]).toBe("q");
  });

  it("maps keys to slots", () => {
    const map = keyToSlot(defaultSkillBinds());
    expect(map.get("q")).toBe(0);
    expect(map.get("y")).toBe(5);
    expect(map.get("bogus")).toBeUndefined();
  });
});
