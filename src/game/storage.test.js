// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StorageManager } from "./storage.js";

const STORAGE_KEY = "giang_ho_game_save_v1";

const SAMPLE = {
  position: { x: 128, y: 256 },
  audioEnabled: false,
  pkFlag: true
};

describe("StorageManager", () => {
  beforeEach(() => {
    localStorage.clear();
    StorageManager.setUserId(null);
    StorageManager.setCharacterId(null);
  });

  it("round-trips a save payload", () => {
    expect(StorageManager.save(SAMPLE)).toBe(true);

    const loaded = StorageManager.load();
    expect(loaded).not.toBeNull();
    expect(loaded.position).toEqual(SAMPLE.position);
    expect(loaded.audioEnabled).toBe(false);
    expect(loaded.pkFlag).toBe(true);
    expect(typeof loaded.savedAt).toBe("number");
  });

  it("never persists server-owned gameplay state", () => {
    StorageManager.save({ ...SAMPLE, stats: { level: 9 }, questRewarded: true });

    const loaded = StorageManager.load();
    expect(loaded.stats).toBeUndefined();
    expect(loaded.questRewarded).toBeUndefined();
  });

  it("round-trips the map the hero was standing on", () => {
    expect(StorageManager.save({ ...SAMPLE, mapId: "dong-mon-thanh" })).toBe(true);
    expect(StorageManager.load().mapId).toBe("dong-mon-thanh");
  });

  it("leaves older saves without a map id untouched", () => {
    expect(StorageManager.save(SAMPLE)).toBe(true);
    expect(StorageManager.load().mapId).toBeUndefined();
  });

  it("returns null when nothing is saved", () => {
    expect(StorageManager.load()).toBeNull();
  });

  it("reflects storage state via exists() and clear()", () => {
    expect(StorageManager.exists()).toBe(false);

    StorageManager.save(SAMPLE);
    expect(StorageManager.exists()).toBe(true);

    expect(StorageManager.clear()).toBe(true);
    expect(StorageManager.exists()).toBe(false);
    expect(StorageManager.load()).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, "{not valid json");

    expect(StorageManager.load()).toBeNull();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for a non-object payload", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(StorageManager.load()).toBeNull();
  });

  it("round-trips persisted stack quantities", () => {
    StorageManager.saveInventory({ "kim-sang-duoc": 42, "tui-bac": 7 });

    expect(StorageManager.loadInventory()).toEqual({
      "kim-sang-duoc": 42,
      "tui-bac": 7
    });
  });

  it("sanitizes invalid inventory entries on save", () => {
    StorageManager.saveInventory({
      good: 3,
      neg: -1,
      str: "5",
      nan: NaN,
      inf: Infinity,
      ["__proto__"]: 9
    });

    expect(StorageManager.loadInventory()).toEqual({ good: 3 });
  });

  it("starts a character with an empty bag when nothing is stored", () => {
    expect(StorageManager.loadInventory()).toEqual({});
  });

  it("purges bags saved before the demo catalog was removed", () => {
    localStorage.setItem("giang_ho_inventory_v1", JSON.stringify({ "kim-sang-duoc": 99 }));
    localStorage.setItem("giang_ho_inventory_v1_char_a", JSON.stringify({ "tui-bac": 21 }));
    const keep = "giang_ho_inventory_v2_char_a";
    localStorage.setItem(keep, JSON.stringify({ "tui-bac": 2 }));

    expect(StorageManager.purgeLegacyInventory()).toBe(2);

    expect(localStorage.getItem("giang_ho_inventory_v1")).toBeNull();
    expect(localStorage.getItem("giang_ho_inventory_v1_char_a")).toBeNull();
    expect(localStorage.getItem(keep)).not.toBeNull();
  });

  it("keeps each character's bag separate", () => {
    StorageManager.setCharacterId("char_a");
    StorageManager.saveInventory({ "tui-bac": 5 });

    StorageManager.setCharacterId("char_b");
    expect(StorageManager.loadInventory()).toEqual({});

    StorageManager.setCharacterId("char_a");
    expect(StorageManager.loadInventory()).toEqual({ "tui-bac": 5 });
  });

  it("falls back to the account key when no character is active", () => {
    StorageManager.setUserId("user_x");
    StorageManager.setCharacterId(null);
    StorageManager.saveInventory({ "tui-bac": 9 });

    StorageManager.setUserId("user_y");
    expect(StorageManager.loadInventory()).toEqual({});
  });

  it("clearInventory removes only the active character's bag", () => {
    StorageManager.setCharacterId("char_a");
    StorageManager.saveInventory({ "tui-bac": 5 });
    StorageManager.clearInventory();
    expect(StorageManager.loadInventory()).toEqual({});
  });
});
