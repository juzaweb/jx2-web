import { describe, it, expect } from "vitest";
import { POSITION_SNAP_THRESHOLD, interpolateEnemyPosition, reconcileEnemyState, sanitizeHp } from "./enemySync.js";

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

describe("interpolateEnemyPosition", () => {
  const current = { x: 840, y: 600 };
  const target = { x: 880, y: 600 };

  it("blends toward the authoritative position without overshooting", () => {
    const next = interpolateEnemyPosition(current, target, 100);

    expect(next.x).toBeGreaterThan(current.x);
    expect(next.x).toBeLessThan(target.x);
    expect(next.y).toBe(600);
  });

  it("covers the same distance in the same time whatever the frame rate", () => {
    const sixtyFps = interpolateEnemyPosition(current, target, 1000 / 60);
    const thirtyFps = interpolateEnemyPosition(current, target, 1000 / 30);

    // Blending is exponential, so one 30 fps step equals two 60 fps steps
    const twoSteps = interpolateEnemyPosition(
      interpolateEnemyPosition(current, target, 1000 / 60),
      target,
      1000 / 60
    );

    expect(twoSteps.x).toBeCloseTo(thirtyFps.x, 6);
    expect(sixtyFps.x).toBeLessThan(thirtyFps.x);
  });

  it("moves further with a longer frame delta", () => {
    expect(interpolateEnemyPosition(current, target, 16).x).toBeLessThan(
      interpolateEnemyPosition(current, target, 64).x
    );
  });

  it("settles exactly on the target within the epsilon", () => {
    expect(interpolateEnemyPosition({ x: 879.5, y: 600 }, target, 16)).toEqual(target);
    expect(interpolateEnemyPosition({ x: 800, y: 600 }, { x: 800, y: 600 }, 16)).toEqual({ x: 800, y: 600 });
  });

  it("holds still for a zero or unusable delta", () => {
    expect(interpolateEnemyPosition(current, target, 0)).toEqual(current);
    expect(interpolateEnemyPosition(current, target, Number.NaN)).toEqual(current);
    expect(interpolateEnemyPosition(current, target, -16)).toEqual(current);
  });

  it("settles onto a distant target it is not allowed to snap to in one frame", () => {
    let position = { x: 840, y: 600 };
    const far = { x: 840 + POSITION_SNAP_THRESHOLD - 1, y: 600 };

    for (let frame = 0; frame < 120; frame++) {
      position = interpolateEnemyPosition(position, far, 16);
    }

    expect(position).toEqual(far);
  });
});
