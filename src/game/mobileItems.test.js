// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_MOBILE_ITEMS,
  MOBILE_ITEM_SLOTS,
  sanitizeMobileItems,
  loadMobileItems,
  saveMobileItems,
  assignMobileItem
} from "./mobileItems.js";

describe("mobileItems", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults every consumable button to empty", () => {
    expect(loadMobileItems("char1")).toEqual(DEFAULT_MOBILE_ITEMS);
    expect(DEFAULT_MOBILE_ITEMS).toHaveLength(MOBILE_ITEM_SLOTS);
    expect(DEFAULT_MOBILE_ITEMS.every((value) => value === null)).toBe(true);
  });

  it("sanitizes raw input into a fixed-length array", () => {
    expect(sanitizeMobileItems(null)).toEqual(DEFAULT_MOBILE_ITEMS);
    expect(sanitizeMobileItems(["kim-sang-duoc", "", 7, "hoi-thanh-phu"])).toEqual([
      "kim-sang-duoc",
      null
    ]);
  });

  it("assigns and clears one button per character", () => {
    let items = assignMobileItem("char1", [], 1, "dai-hoan-dan");
    expect(items[1]).toBe("dai-hoan-dan");
    expect(loadMobileItems("char1")[1]).toBe("dai-hoan-dan");

    items = assignMobileItem("char1", items, 1, null);
    expect(items[1]).toBeNull();

    // A different hero keeps their own buttons.
    expect(loadMobileItems("char2")).toEqual(DEFAULT_MOBILE_ITEMS);
  });

  it("ignores out-of-range indexes and keeps the current bindings", () => {
    const current = ["kim-sang-duoc", null];
    expect(assignMobileItem("char1", current, 5, "dai-hoan-dan")).toEqual(current);
    expect(assignMobileItem("char1", current, -1, "dai-hoan-dan")).toEqual(current);
  });

  it("round-trips through storage", () => {
    const saved = saveMobileItems("char1", ["nu-nhi-hong", "hoi-thanh-phu"]);
    expect(loadMobileItems("char1")).toEqual(saved);
    expect(saved).toEqual(["nu-nhi-hong", "hoi-thanh-phu"]);
  });
});
