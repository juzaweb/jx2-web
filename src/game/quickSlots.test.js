// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_QUICK_SLOTS,
  sanitizeQuickSlots,
  loadQuickSlots,
  saveQuickSlots,
  assignQuickSlot,
  clearQuickSlot,
  moveQuickSlot,
  skillBinding,
  isSkillBinding,
  skillIdFromBinding
} from "./quickSlots.js";

describe("quickSlots", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults all 9 slots to null", () => {
    const slots = loadQuickSlots("char123");
    expect(slots).toEqual(DEFAULT_QUICK_SLOTS);
    for (let i = 1; i <= 9; i++) {
      expect(slots[i]).toBeNull();
    }
  });

  it("sanitizes invalid raw input", () => {
    const sanitized = sanitizeQuickSlots({ 1: "kim-sang-duoc", 2: "", 10: "invalid", bar: "foo" });
    expect(sanitized[1]).toBe("kim-sang-duoc");
    expect(sanitized[2]).toBeNull();
    expect(sanitized[10]).toBeUndefined();
  });

  it("saves and loads quick slots per character", () => {
    const char1Slots = assignQuickSlot("char1", {}, 1, "kim-sang-duoc");
    expect(char1Slots[1]).toBe("kim-sang-duoc");

    const loaded1 = loadQuickSlots("char1");
    expect(loaded1[1]).toBe("kim-sang-duoc");

    const loaded2 = loadQuickSlots("char2");
    expect(loaded2[1]).toBeNull();
  });

  it("clears quick slot", () => {
    let slots = assignQuickSlot("char1", {}, 3, "dai-hoan-dan");
    expect(slots[3]).toBe("dai-hoan-dan");

    slots = clearQuickSlot("char1", slots, 3);
    expect(slots[3]).toBeNull();
  });

  it("moves and swaps quick slots", () => {
    let slots = assignQuickSlot("char1", {}, 1, "kim-sang-duoc");
    slots = assignQuickSlot("char1", slots, 5, "hoi-thanh-phu");

    slots = moveQuickSlot("char1", slots, 1, 5);
    expect(slots[1]).toBe("hoi-thanh-phu");
    expect(slots[5]).toBe("kim-sang-duoc");
  });

  it("tags skill bindings apart from item ids", () => {
    expect(skillBinding("dai_tu_di_chuong")).toBe("skill:dai_tu_di_chuong");
    expect(isSkillBinding("skill:dai_tu_di_chuong")).toBe(true);
    expect(isSkillBinding("kim-sang-duoc")).toBe(false);
    expect(skillIdFromBinding("skill:dai_tu_di_chuong")).toBe("dai_tu_di_chuong");
    expect(skillIdFromBinding("kim-sang-duoc")).toBeNull();
    expect(skillIdFromBinding(null)).toBeNull();
  });

  it("stores a skill binding in a numbered slot", () => {
    const slots = assignQuickSlot("char1", {}, 2, skillBinding("la_han_tran"));
    expect(slots[2]).toBe("skill:la_han_tran");
  });
});
