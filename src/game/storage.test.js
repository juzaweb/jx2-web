import { describe, it, expect, beforeEach } from "vitest";
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
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(StorageManager.load()).toBeNull();
  });

  it("returns null when the payload has no stats", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 1 }));
    expect(StorageManager.load()).toBeNull();
  });

  it("coerces questRewarded to a boolean on save", () => {
    StorageManager.save({ ...SAMPLE, questRewarded: undefined });
    expect(StorageManager.load().questRewarded).toBe(false);
  });
});
