import { describe, it, expect, vi } from "vitest";
import {
  QUICK_ITEMS,
  INVENTORY_ITEMS,
  INVENTORY_CAPACITY,
  INVENTORY_TREASURY,
  defaultQuantities,
  applyQuantities,
  setQuantities,
  getQuantities,
  addQuantity,
  DROP_TABLE,
  rollDrop
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

describe("addQuantity", () => {
  it("accumulates onto the current value", () => {
    setQuantities({ "tui-bac": 21 });

    expect(addQuantity("tui-bac", 3)).toBe(24);
    expect(addQuantity("tui-bac")).toBe(25);
    expect(getQuantities()["tui-bac"]).toBe(25);
  });

  it("starts an unknown-but-valid id from zero", () => {
    setQuantities({});

    expect(addQuantity("cong-cu-moi", 4)).toBe(4);
    expect(getQuantities()["cong-cu-moi"]).toBe(4);
  });

  it("initializes the shared store from catalog defaults when unset", async () => {
    vi.resetModules();
    const fresh = await import("./items.js");

    // "dai-hoan-dan" ships with a catalog default of 86.
    expect(fresh.addQuantity("dai-hoan-dan", 2)).toBe(88);
    expect(fresh.getQuantities()["dai-hoan-dan"]).toBe(88);
  });

  it("ignores an invalid id without throwing or mutating the store", () => {
    setQuantities({ "tui-bac": 21 });

    expect(() => addQuantity("", 5)).not.toThrow();
    expect(addQuantity("", 5)).toBe(0);
    expect(addQuantity(null, 5)).toBe(0);
    expect(addQuantity(undefined, 5)).toBe(0);
    expect(getQuantities()["tui-bac"]).toBe(21);
  });

  it("ignores non-positive or non-finite amounts and returns the current value", () => {
    setQuantities({ "tui-bac": 21 });

    expect(addQuantity("tui-bac", 0)).toBe(21);
    expect(addQuantity("tui-bac", -5)).toBe(21);
    expect(addQuantity("tui-bac", Number.NaN)).toBe(21);
    expect(addQuantity("tui-bac", Number.POSITIVE_INFINITY)).toBe(21);
    expect(addQuantity("tui-bac", "3")).toBe(21);
    expect(getQuantities()["tui-bac"]).toBe(21);
  });
});

describe("rollDrop", () => {
  const catalogIds = new Set([
    ...QUICK_ITEMS.map((item) => item.id),
    ...INVENTORY_ITEMS.filter(Boolean).map((item) => item.id)
  ]);

  it("exposes a weighted drop table of at least two catalog-backed entries", () => {
    expect(DROP_TABLE.length).toBeGreaterThanOrEqual(2);
    DROP_TABLE.forEach((entry) => {
      expect(catalogIds.has(entry.id)).toBe(true);
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.weight).toBeGreaterThan(0);
      expect(entry.qty).toBeGreaterThanOrEqual(1);
    });
  });

  it("is deterministic for a fixed rng", () => {
    expect(rollDrop(() => 0.42)).toEqual(rollDrop(() => 0.42));
    expect(rollDrop(() => 0)).toEqual(rollDrop(() => 0));
  });

  it("selects the first bucket at the low boundary and the last at the high boundary", () => {
    expect(rollDrop(() => 0).id).toBe(DROP_TABLE[0].id);
    expect(rollDrop(() => 0.999999).id).toBe(DROP_TABLE[DROP_TABLE.length - 1].id);
    // roll === 1 is clamped, never overflowing past the final bucket.
    expect(rollDrop(() => 1).id).toBe(DROP_TABLE[DROP_TABLE.length - 1].id);
  });

  it("always returns a catalog id with an integer qty of at least one", () => {
    let seed = 123456789;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let i = 0; i < 500; i++) {
      const drop = rollDrop(rng);
      expect(catalogIds.has(drop.id)).toBe(true);
      expect(Number.isInteger(drop.qty)).toBe(true);
      expect(drop.qty).toBeGreaterThanOrEqual(1);
    }
  });
});
