import { describe, it, expect, vi } from "vitest";
import {
  sanitizeInventory,
  inventorySignature,
  hasInventory,
  planInventorySync,
  InventorySyncer
} from "./inventorySync.js";

describe("sanitizeInventory", () => {
  it("keeps non-negative integer stacks", () => {
    expect(sanitizeInventory({ "kim-sang-duoc": 7, "tui-bac": 0 })).toEqual({
      "kim-sang-duoc": 7,
      "tui-bac": 0
    });
  });

  it("floors fractional quantities", () => {
    expect(sanitizeInventory({ "tui-bac": 3.9 })).toEqual({ "tui-bac": 3 });
  });

  it("drops invalid, negative and non-finite values", () => {
    expect(
      sanitizeInventory({
        a: -1,
        b: Number.NaN,
        c: Number.POSITIVE_INFINITY,
        d: "5",
        e: null,
        f: 2
      })
    ).toEqual({ f: 2 });
  });

  it("strips prototype-polluting keys", () => {
    const dirty = JSON.parse('{"__proto__": 5, "constructor": 3, "safe": 4}');
    expect(sanitizeInventory(dirty)).toEqual({ safe: 4 });
  });

  it("returns an empty map for non-objects", () => {
    expect(sanitizeInventory(null)).toEqual({});
    expect(sanitizeInventory(undefined)).toEqual({});
    expect(sanitizeInventory([1, 2, 3])).toEqual({});
    expect(sanitizeInventory("nope")).toEqual({});
  });
});

describe("inventorySignature", () => {
  it("is independent of key order", () => {
    expect(inventorySignature({ a: 1, b: 2 })).toBe(inventorySignature({ b: 2, a: 1 }));
  });

  it("changes when a quantity changes", () => {
    expect(inventorySignature({ a: 1 })).not.toBe(inventorySignature({ a: 2 }));
  });
});

describe("hasInventory", () => {
  it("is false for empty or invalid payloads", () => {
    expect(hasInventory({})).toBe(false);
    expect(hasInventory(null)).toBe(false);
  });

  it("is true once any usable entry exists, including a zeroed stack", () => {
    expect(hasInventory({ "tui-bac": 0 })).toBe(true);
  });
});

describe("planInventorySync", () => {
  it("adopts the server bag when it holds data", () => {
    expect(
      planInventorySync({ "tui-bac": 5 }, { "tui-bac": 21, "kim-sang-duoc": 99 })
    ).toEqual({ action: "adopt", quantities: { "tui-bac": 5 } });
  });

  it("adopts an all-zero server bag instead of treating it as empty", () => {
    expect(planInventorySync({ "tui-bac": 0 }, { "tui-bac": 21 })).toEqual({
      action: "adopt",
      quantities: { "tui-bac": 0 }
    });
  });

  it("pushes the local bag when the server has none", () => {
    expect(planInventorySync({}, { "tui-bac": 21 })).toEqual({
      action: "push",
      quantities: { "tui-bac": 21 }
    });
  });

  it("sanitizes both sides before deciding", () => {
    expect(planInventorySync({ "tui-bac": -1 }, { "tui-bac": 21 })).toEqual({
      action: "push",
      quantities: { "tui-bac": 21 }
    });
  });
});

describe("InventorySyncer", () => {
  const make = ({ ownerId = "char_1", local = { "tui-bac": 21 }, server = {} } = {}) => {
    const quantities = { ...local };
    const api = {
      getInventory: vi.fn(async () => server),
      updateInventory: vi.fn(async () => quantities)
    };
    const onAdopt = vi.fn();
    const onError = vi.fn();
    const syncer = new InventorySyncer({
      api,
      getOwnerId: () => ownerId,
      getQuantities: () => quantities,
      setQuantities: (next) => Object.assign(quantities, next),
      onAdopt,
      onError
    });
    return { syncer, api, quantities, onAdopt, onError };
  };

  it("blocks uploads until the bag has been reconciled", () => {
    const { syncer, api } = make();
    syncer.reset();

    syncer.sync();
    expect(api.updateInventory).not.toHaveBeenCalled();
  });

  it("adopts the server bag on load and does not echo it back", async () => {
    const { syncer, api, quantities, onAdopt } = make({ server: { "tui-bac": 4 } });

    await syncer.load();

    expect(quantities["tui-bac"]).toBe(4);
    expect(onAdopt).toHaveBeenCalledTimes(1);
    expect(api.updateInventory).not.toHaveBeenCalled();
  });

  it("pushes the local bag when the server has none", async () => {
    const { syncer, api } = make({ server: {} });

    await syncer.load();

    expect(api.updateInventory).toHaveBeenCalledWith("char_1", { "tui-bac": 21 });
  });

  it("skips a redundant upload until the signature changes", async () => {
    const { syncer, api, quantities } = make({ server: {} });
    await syncer.load();
    expect(api.updateInventory).toHaveBeenCalledTimes(1);

    syncer.sync();
    expect(api.updateInventory).toHaveBeenCalledTimes(1);

    quantities["tui-bac"] = 20;
    syncer.sync();
    expect(api.updateInventory).toHaveBeenCalledTimes(2);
  });

  it("reports an upload failure and retries on the next sync", async () => {
    const { syncer, api, onError } = make({ server: {} });
    api.updateInventory.mockRejectedValueOnce(new Error("offline"));

    await syncer.load();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledTimes(1);

    syncer.sync();
    expect(api.updateInventory).toHaveBeenCalledTimes(2);
  });

  it("does nothing without an owning character", async () => {
    const { syncer, api } = make({ ownerId: null });

    syncer.sync();
    await syncer.load();
    expect(api.updateInventory).not.toHaveBeenCalled();
    expect(api.getInventory).not.toHaveBeenCalled();
  });
});
