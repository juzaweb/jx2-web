import { describe, it, expect } from "vitest";
import {
  QUICK_ITEMS,
  INVENTORY_ITEMS,
  INVENTORY_CAPACITY,
  INVENTORY_TREASURY,
  defaultQuantities,
  applyQuantities,
  setQuantities,
  getQuantities
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

describe("inventory quantities", () => {
  it("collects a default quantity for every stacked catalog item", () => {
    const quantities = defaultQuantities();
    QUICK_ITEMS.forEach((item) => expect(quantities[item.id]).toBe(item.qty));
    INVENTORY_ITEMS.filter(Boolean).forEach((item) => {
      if (typeof item.qty === "number") {
        expect(quantities[item.id]).toBe(item.qty);
      }
    });
  });

  it("does not assign quantities to quantity-less equipment", () => {
    const quantities = defaultQuantities();
    const weapon = INVENTORY_ITEMS.find((item) => item && item.id === "hac-ung-kiem");
    expect(quantities[weapon.id]).toBeUndefined();
  });

  it("applies persisted quantities over the catalog", () => {
    const { quickItems, inventoryItems } = applyQuantities({
      "kim-sang-duoc": 7,
      "tui-bac": 0
    });

    expect(quickItems.find((item) => item.id === "kim-sang-duoc").qty).toBe(7);
    expect(inventoryItems.find((item) => item.id === "tui-bac").qty).toBe(0);
    // Items with no saved or default quantity stay untouched.
    expect(inventoryItems.find((item) => item.id === "hac-ung-kiem").qty).toBeUndefined();
  });

  it("keeps the shared in-memory store merged over defaults", () => {
    setQuantities({ "kim-sang-duoc": 1 });

    expect(getQuantities()["kim-sang-duoc"]).toBe(1);
    // An untouched item keeps its catalog default.
    expect(getQuantities()["dai-hoan-dan"]).toBe(86);
  });
});
