// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StorageManager } from "./storage.js";

const STORAGE_KEY = "giang_ho_game_save_v1";

const SAMPLE = {
  stats: {
    level: 3,
    hp: 80,
    maxHp: 100,
    mp: 30,
    maxMp: 60,
    exp: 40,
    nextExp: 200,
    coins: 120,
    kills: 7,
    sta: 90,
    maxSta: 100
  },
  position: { x: 128, y: 256 },
  questRewarded: true,
  audioEnabled: false
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
    expect(loaded.stats).toEqual(SAMPLE.stats);
    expect(loaded.position).toEqual(SAMPLE.position);
    expect(loaded.questRewarded).toBe(true);
    expect(loaded.audioEnabled).toBe(false);
    expect(typeof loaded.savedAt).toBe("number");
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

  it("returns null when the payload has no stats", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 1 }));
    expect(StorageManager.load()).toBeNull();
  });

  it("coerces questRewarded to a boolean on save", () => {
    StorageManager.save({ ...SAMPLE, questRewarded: undefined });
    expect(StorageManager.load().questRewarded).toBe(false);
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

  it("merges saved values over the provided defaults", () => {
    StorageManager.saveInventory({ "kim-sang-duoc": 12 });

    expect(
      StorageManager.loadInventory({ "kim-sang-duoc": 99, "dai-hoan-dan": 86 })
    ).toEqual({ "kim-sang-duoc": 12, "dai-hoan-dan": 86 });
  });

  it("keeps each character's bag separate", () => {
    StorageManager.setCharacterId("char_a");
    StorageManager.saveInventory({ "tui-bac": 5 });

    StorageManager.setCharacterId("char_b");
    expect(StorageManager.loadInventory({ "tui-bac": 21 })).toEqual({ "tui-bac": 21 });

    StorageManager.setCharacterId("char_a");
    expect(StorageManager.loadInventory({ "tui-bac": 21 })).toEqual({ "tui-bac": 5 });
  });

  it("falls back to the account key when no character is active", () => {
    StorageManager.setUserId("user_x");
    StorageManager.setCharacterId(null);
    StorageManager.saveInventory({ "tui-bac": 9 });

    StorageManager.setUserId("user_y");
    expect(StorageManager.loadInventory({ "tui-bac": 21 })).toEqual({ "tui-bac": 21 });
  });

  it("clearInventory removes only the active character's bag", () => {
    StorageManager.setCharacterId("char_a");
    StorageManager.saveInventory({ "tui-bac": 5 });
    StorageManager.clearInventory();
    expect(StorageManager.loadInventory({ "tui-bac": 21 })).toEqual({ "tui-bac": 21 });
  });

  it("returns defaults when no inventory is stored", () => {
    expect(StorageManager.loadInventory({ "tui-bac": 21 })).toEqual({ "tui-bac": 21 });
  });
});
