import { describe, it, expect } from "vitest";
import { POSITION_SNAP_THRESHOLD, reconcileEnemyState, sanitizeHp } from "./enemySync.js";

const localWolf = { x: 840, y: 600, hp: 45, maxHp: 45, isDead: false };

describe("sanitizeHp", () => {
  it("clamps server hp into [0, maxHp]", () => {
    expect(sanitizeHp(30, 45)).toBe(30);
    expect(sanitizeHp(-12, 45)).toBe(0);
    expect(sanitizeHp(500, 45)).toBe(45);
  });

  it("rejects non-numeric and non-finite values", () => {
    expect(sanitizeHp(undefined, 45)).toBeNull();
    expect(sanitizeHp("30", 45)).toBeNull();
    expect(sanitizeHp(Number.NaN, 45)).toBeNull();
    expect(sanitizeHp(Number.POSITIVE_INFINITY, 45)).toBeNull();
  });

  it("falls back to the server value when maxHp is unavailable", () => {
    expect(sanitizeHp(20, undefined)).toBe(20);
  });
});

describe("reconcileEnemyState", () => {
  it("applies the authoritative server hp so nearby players stay in sync", () => {
    const result = reconcileEnemyState(localWolf, { hp: 20 });
    expect(result.hp).toBe(20);
    expect(result.isDead).toBe(false);
    expect(result.snap).toBe(false);
  });

  it("keeps local hp when the snapshot carries no hp", () => {
    const result = reconcileEnemyState(localWolf, { x: 850, y: 610 });
    expect(result.hp).toBe(45);
  });

  it("marks the enemy dead when the server reports it dead or out of hp", () => {
    expect(reconcileEnemyState(localWolf, { hp: 0, isDead: true }).isDead).toBe(true);
    expect(reconcileEnemyState(localWolf, { hp: 0 }).isDead).toBe(true);
  });

  it("revives a locally dead enemy when the server reports it alive", () => {
    const dead = { ...localWolf, hp: 0, isDead: true };
    const result = reconcileEnemyState(dead, { hp: 45, isDead: false });
    expect(result.hp).toBe(45);
    expect(result.isDead).toBe(false);
  });

  it("snaps position only when the drift exceeds the threshold", () => {
    const near = reconcileEnemyState(localWolf, { x: 850, y: 610 });
    expect(near.snap).toBe(false);

    const far = reconcileEnemyState(localWolf, { x: 840 + POSITION_SNAP_THRESHOLD + 5, y: 600 });
    expect(far.snap).toBe(true);
  });

  it("never snaps a corpse, so a dead wolf stays where it fell", () => {
    const farCorpse = { hp: 0, isDead: true, x: 1400, y: 700 };
    expect(reconcileEnemyState(localWolf, farCorpse).snap).toBe(false);
  });

  it("never snaps without a usable server position", () => {
    expect(reconcileEnemyState(localWolf, { hp: 10 }).snap).toBe(false);
    expect(reconcileEnemyState(localWolf, { x: Number.NaN, y: 600 }).snap).toBe(false);
  });
});
