import { describe, it, expect } from "vitest";
import {
  QUICK_ITEMS,
  INVENTORY_ITEMS,
  INVENTORY_CAPACITY,
  INVENTORY_TREASURY
} from "./items.js";

describe("item catalog", () => {
  it("exposes four quick-slot consumables bound to hotbar keys 1-4", () => {
    expect(QUICK_ITEMS).toHaveLength(4);
    QUICK_ITEMS.forEach((item, index) => {
      expect(item.useSlot).toBe(index + 1);
      expect(item.id).toMatch(/^[a-z0-9-]+$/);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
      expect(item.desc.length).toBeGreaterThan(0);
      expect(typeof item.qty).toBe("number");
    });
  });

  it("has unique quick-item ids", () => {
    const ids = QUICK_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fills a 5x6 inventory grid (30 slots)", () => {
    expect(INVENTORY_ITEMS).toHaveLength(30);
    expect(INVENTORY_ITEMS.some((slot) => slot === null)).toBe(false);
  });

  it("gives every inventory slot the required display fields", () => {
    INVENTORY_ITEMS.filter(Boolean).forEach((item) => {
      expect(typeof item.id).toBe("string");
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.name).toBe("string");
      expect(typeof item.icon).toBe("string");
      expect(typeof item.desc).toBe("string");
    });
  });

  it("has unique inventory item ids", () => {
    const ids = INVENTORY_ITEMS.filter(Boolean).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exposes numeric carry weight and treasury values", () => {
    expect(INVENTORY_CAPACITY.used).toBeLessThanOrEqual(INVENTORY_CAPACITY.total);
    expect(INVENTORY_CAPACITY.total).toBeGreaterThan(0);
    Object.values(INVENTORY_TREASURY).forEach((value) => {
      expect(typeof value).toBe("number");
    });
  });
});
