import { describe, it, expect, vi } from "vitest";
import {
  QUICK_ITEMS,
  INVENTORY_ITEMS,
  INVENTORY_GRID_SIZE,
  STARTER_ITEMS,
  splitSilver,
  defaultQuantities,
  applyQuantities,
  setQuantities,
  replaceQuantities,
  getQuantities,
  getQuantity,
  addQuantity,
  consumeQuantity,
  rollKillReward,
  KILL_REWARD,
  CONSUMABLE_EFFECTS,
  getConsumableEffect
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
      expect(item.qty).toBeUndefined();
    });
  });

  it("has unique quick-item ids", () => {
    const ids = QUICK_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists fewer catalog entries than the rendered grid, which pads the rest", () => {
    // The catalog only holds items that can actually be obtained or used, so the
    // fixed-size grid is completed with empty cells by applyQuantities().
    expect(INVENTORY_ITEMS.length).toBeGreaterThan(0);
    expect(INVENTORY_ITEMS.length).toBeLessThanOrEqual(INVENTORY_GRID_SIZE);
  });

  it("gives every inventory slot the required display fields", () => {
    INVENTORY_ITEMS.filter(Boolean).forEach((item) => {
      expect(typeof item.id).toBe("string");
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.name).toBe("string");
      expect(typeof item.icon).toBe("string");
      expect(typeof item.desc).toBe("string");
      expect(item.qty).toBeUndefined();
    });
  });

  it("has unique inventory item ids", () => {
    const ids = INVENTORY_ITEMS.filter(Boolean).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("derives carry capacity from the owned stacks", () => {
    const { capacity } = applyQuantities({ "kim-sang-duoc": 2, "dai-hoan-dan": 9 });
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
  it("starts every character with an empty bag", () => {
    expect(defaultQuantities()).toEqual({});
  });

  it("gives the starter kit only catalog-backed, usable items", () => {
    const catalogIds = new Set(INVENTORY_ITEMS.filter(Boolean).map((item) => item.id));

    expect(Object.keys(STARTER_ITEMS).sort()).toEqual([
      "dai-hoan-dan",
      "hoi-thanh-phu",
      "kim-sang-duoc"
    ]);
    Object.entries(STARTER_ITEMS).forEach(([id, qty]) => {
      expect(catalogIds.has(id)).toBe(true);
      expect(Number.isInteger(qty)).toBe(true);
      expect(qty).toBeGreaterThan(0);
    });
  });

  it("only renders owned stacks and pads the grid with empty slots", () => {
    const { quickItems, inventoryItems } = applyQuantities({
      "kim-sang-duoc": 7,
      "tui-bac": 0
    });

    expect(quickItems.find((item) => item.id === "kim-sang-duoc").qty).toBe(7);
    // Unowned items are hidden entirely rather than rendered as an empty stack.
    expect(quickItems.find((item) => item.id === "dai-hoan-dan")).toBeUndefined();
    expect(quickItems).toHaveLength(1);
    expect(inventoryItems.find((item) => item?.id === "tui-bac")).toBeUndefined();
    expect(inventoryItems.find((item) => item?.id === "kim-sang-duoc").qty).toBe(7);
    expect(inventoryItems.filter(Boolean)).toHaveLength(1);
    expect(inventoryItems).toHaveLength(INVENTORY_GRID_SIZE);
    expect(inventoryItems.slice(1).every((item) => item === null)).toBe(true);
  });

  it("renders nothing for a character that owns nothing", () => {
    const { quickItems, inventoryItems, capacity } = applyQuantities({});

    expect(quickItems).toEqual([]);
    expect(inventoryItems.filter(Boolean)).toHaveLength(0);
    expect(inventoryItems).toHaveLength(INVENTORY_GRID_SIZE);
    expect(capacity).toEqual({ used: 0, total: INVENTORY_GRID_SIZE });
  });

  it("drops server-owned ids that are missing from the catalog", () => {
    const { inventoryItems, capacity } = applyQuantities({ "bi-kip-la": 3 });

    expect(inventoryItems.find((item) => item?.id === "bi-kip-la")).toBeUndefined();
    expect(inventoryItems.filter(Boolean)).toHaveLength(0);
    expect(inventoryItems).toHaveLength(INVENTORY_GRID_SIZE);
    expect(capacity).toEqual({ used: 0, total: INVENTORY_GRID_SIZE });
  });

  it("keeps the shared in-memory store limited to what was set", () => {
    setQuantities({ "kim-sang-duoc": 1 });

    expect(getQuantities()["kim-sang-duoc"]).toBe(1);
    // An untouched item is not owned, so it must not inherit a catalog default.
    expect(getQuantities()["dai-hoan-dan"]).toBeUndefined();
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

  it("starts an unset shared store from an empty bag", async () => {
    vi.resetModules();
    const fresh = await import("./items.js");

    // Nothing is owned until it is earned, so the first add starts from zero.
    expect(fresh.addQuantity("dai-hoan-dan", 2)).toBe(2);
    expect(fresh.getQuantities()["dai-hoan-dan"]).toBe(2);
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

  it("refuses to consume from an unset shared store", async () => {
    vi.resetModules();
    const fresh = await import("./items.js");

    // Nothing is owned until it is earned, so the first consume is refused.
    expect(fresh.consumeQuantity("dai-hoan-dan", 1)).toEqual({ ok: false, quantity: 0 });
    expect(fresh.getQuantity("dai-hoan-dan")).toBe(0);
  });
});

describe("consumable effects", () => {
  it("describes the server-owned effect of every usable item", () => {
    expect(CONSUMABLE_EFFECTS["kim-sang-duoc"]).toEqual({ hp: 35 });
    expect(CONSUMABLE_EFFECTS["dai-hoan-dan"]).toEqual({ mp: 25 });
    expect(CONSUMABLE_EFFECTS["nu-nhi-hong"]).toEqual({ hp: 50, mp: 30 });
    expect(CONSUMABLE_EFFECTS["hoi-thanh-phu"]).toEqual({ teleport: "spawn" });
  });

  it("looks effects up only for known ids", () => {
    expect(getConsumableEffect("kim-sang-duoc")).toEqual({ hp: 35 });
    expect(getConsumableEffect("ao-lang-khach")).toBeNull();
    expect(getConsumableEffect("")).toBeNull();
    expect(getConsumableEffect(null)).toBeNull();
  });
});

describe("rollKillReward", () => {
  it("is deterministic and lands on the documented minimums for rng 0", () => {
    const reward = rollKillReward(() => 0);

    expect(reward).toEqual(rollKillReward(() => 0));
    expect(reward.exp).toBe(KILL_REWARD.exp);
    expect(reward.coins).toBe(KILL_REWARD.coinsMin);
  });

  it("caps the bạc roll at the documented maximum", () => {
    expect(rollKillReward(() => 0.999999).coins).toBe(KILL_REWARD.coinsMax);
    expect(rollKillReward(() => 1).coins).toBe(KILL_REWARD.coinsMax);
    expect(rollKillReward(89).coins).toBe(KILL_REWARD.coinsMax);
  });

  it("pays EXP and bạc only, never an item", () => {
    for (let i = 0; i <= 20; i++) {
      const reward = rollKillReward(i / 20);

      expect(Object.keys(reward).sort()).toEqual(["coins", "exp"]);
      expect(reward.coins).toBeGreaterThanOrEqual(KILL_REWARD.coinsMin);
      expect(reward.coins).toBeLessThanOrEqual(KILL_REWARD.coinsMax);
    }
  });
});
