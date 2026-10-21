import { describe, it, expect, vi } from "vitest";
import {
  QUICK_ITEMS,
  INVENTORY_ITEMS,
  INVENTORY_GRID_SIZE,
  splitSilver,
  defaultQuantities,
  applyQuantities,
  setQuantities,
  replaceQuantities,
  getQuantities,
  getQuantity,
  addQuantity,
  consumeQuantity,
  DROP_TABLE,
  rollDrop,
  rollKillReward,
  KILL_REWARD
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

  it("fills at least a 5x6 inventory grid (30 slots)", () => {
    expect(INVENTORY_ITEMS.length).toBeGreaterThanOrEqual(30);
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

  it("derives carry capacity from the owned stacks", () => {
    const { capacity } = applyQuantities({ "tui-bac": 2, "yeu-dan": 9 });
    expect(capacity).toEqual({ used: 2, total: INVENTORY_GRID_SIZE });

    const empty = applyQuantities({}).capacity;
    expect(empty).toEqual({ used: 0, total: INVENTORY_GRID_SIZE });
  });

  it("splits a silver balance into gold, silver and copper", () => {
    expect(splitSilver(0)).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(splitSilver(250)).toEqual({ gold: 2, silver: 50, copper: 0 });
    expect(splitSilver(-5)).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(splitSilver(Number.NaN)).toEqual({ gold: 0, silver: 0, copper: 0 });
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

  it("only renders owned stacks and pads the grid with empty slots", () => {
    const { quickItems, inventoryItems } = applyQuantities({
      "kim-sang-duoc": 7,
      "tui-bac": 0
    });

    expect(quickItems.find((item) => item.id === "kim-sang-duoc").qty).toBe(7);
    // A depleted / missing quick item must show zero, never its catalog default.
    expect(quickItems.find((item) => item.id === "dai-hoan-dan").qty).toBe(0);
    expect(inventoryItems.find((item) => item?.id === "tui-bac")).toBeUndefined();
    expect(inventoryItems.find((item) => item?.id === "kim-sang-duoc").qty).toBe(7);
    expect(inventoryItems.filter(Boolean)).toHaveLength(1);
    expect(inventoryItems).toHaveLength(INVENTORY_GRID_SIZE);
    expect(inventoryItems.slice(1).every((item) => item === null)).toBe(true);
  });

  it("keeps unknown server-owned ids visible after the catalog", () => {
    const { inventoryItems, capacity } = applyQuantities({ "bi-kip-la": 3 });
    const unknown = inventoryItems.find((item) => item?.id === "bi-kip-la");

    expect(unknown).toMatchObject({
      id: "bi-kip-la",
      name: "bi-kip-la",
      qty: 3
    });
    expect(capacity).toEqual({ used: 1, total: INVENTORY_GRID_SIZE });
  });

  it("keeps the shared in-memory store merged over defaults", () => {
    setQuantities({ "kim-sang-duoc": 1 });

    expect(getQuantities()["kim-sang-duoc"]).toBe(1);
    // An untouched item keeps its catalog default.
    expect(getQuantities()["dai-hoan-dan"]).toBe(86);
  });

  it("replaces the store exactly when adopting the server bag", () => {
    replaceQuantities({ "kim-sang-duoc": 0, "tui-bac": 2 });

    expect(getQuantities()).toEqual({ "kim-sang-duoc": 0, "tui-bac": 2 });
    expect(getQuantities()["dai-hoan-dan"]).toBeUndefined();
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

describe("getQuantity", () => {
  it("reads the current stack and floors it", () => {
    setQuantities({ "kim-sang-duoc": 3 });
    expect(getQuantity("kim-sang-duoc")).toBe(3);
  });

  it("returns 0 for an unknown or invalid id without mutating the store", () => {
    setQuantities({ "tui-bac": 21 });
    expect(getQuantity("khong-ton-tai")).toBe(0);
    expect(getQuantity("")).toBe(0);
    expect(getQuantity(null)).toBe(0);
    expect(getQuantities()["tui-bac"]).toBe(21);
  });
});

describe("consumeQuantity", () => {
  it("removes one from the stack by default", () => {
    setQuantities({ "kim-sang-duoc": 5 });

    expect(consumeQuantity("kim-sang-duoc")).toEqual({ ok: true, quantity: 4 });
    expect(getQuantity("kim-sang-duoc")).toBe(4);
  });

  it("removes an explicit amount", () => {
    setQuantities({ "tui-bac": 10 });

    expect(consumeQuantity("tui-bac", 4)).toEqual({ ok: true, quantity: 6 });
  });

  it("allows consuming the last unit down to zero", () => {
    setQuantities({ "kim-sang-duoc": 1 });

    expect(consumeQuantity("kim-sang-duoc")).toEqual({ ok: true, quantity: 0 });
    // Further use is refused; the stack never goes negative.
    expect(consumeQuantity("kim-sang-duoc")).toEqual({ ok: false, quantity: 0 });
  });

  it("refuses an amount larger than the stack without mutating it", () => {
    setQuantities({ "tui-bac": 2 });

    expect(consumeQuantity("tui-bac", 3)).toEqual({ ok: false, quantity: 2 });
    expect(getQuantity("tui-bac")).toBe(2);
  });

  it("refuses an empty stack, an invalid id, or an invalid amount", () => {
    setQuantities({ "tui-bac": 0 });

    expect(consumeQuantity("tui-bac")).toEqual({ ok: false, quantity: 0 });
    expect(consumeQuantity("", 1)).toEqual({ ok: false, quantity: 0 });
    expect(consumeQuantity("tui-bac", 0)).toEqual({ ok: false, quantity: 0 });
    expect(consumeQuantity("tui-bac", -2)).toEqual({ ok: false, quantity: 0 });
    expect(consumeQuantity("tui-bac", Number.NaN)).toEqual({ ok: false, quantity: 0 });
  });

  it("initializes the shared store from catalog defaults when unset", async () => {
    vi.resetModules();
    const fresh = await import("./items.js");

    // "dai-hoan-dan" ships with a catalog default of 86.
    expect(fresh.consumeQuantity("dai-hoan-dan", 1)).toEqual({ ok: true, quantity: 85 });
    expect(fresh.getQuantity("dai-hoan-dan")).toBe(85);
  });
});

describe("rollDrop", () => {  const catalogIds = new Set([
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

describe("rollKillReward", () => {
  it("is deterministic and lands on the documented minimums for rng 0", () => {
    const reward = rollKillReward(() => 0);

    expect(reward).toEqual(rollKillReward(() => 0));
    expect(reward.exp).toBe(KILL_REWARD.exp);
    expect(reward.coins).toBe(KILL_REWARD.coinsMin);
    expect(reward.drop.id).toBe(DROP_TABLE[0].id);
  });

  it("caps the bạc roll at the documented maximum", () => {
    expect(rollKillReward(() => 0.999999).coins).toBe(KILL_REWARD.coinsMax);
    expect(rollKillReward(() => 1).coins).toBe(KILL_REWARD.coinsMax);
    expect(rollKillReward(89).coins).toBe(KILL_REWARD.coinsMax);
  });

  it("always returns a catalog drop with a positive integer quantity", () => {
    for (let i = 0; i <= 20; i++) {
      const reward = rollKillReward(i / 20);
      const entry = DROP_TABLE.find((item) => item.id === reward.drop.id);

      expect(entry).toBeDefined();
      expect(reward.drop.qty).toBe(entry.qty);
      expect(reward.coins).toBeGreaterThanOrEqual(KILL_REWARD.coinsMin);
      expect(reward.coins).toBeLessThanOrEqual(KILL_REWARD.coinsMax);
    }
  });
});
