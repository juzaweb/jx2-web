import { describe, it, expect } from "vitest";
import {
  canPvpAttack,
  clampPvpDamage,
  dodgeChance,
  rollDodge,
  PVP_ATTACK_RANGE,
  PVP_DODGE_MIN_SPEED,
  PVP_MAX_DAMAGE,
  PVP_MAX_DODGE
} from "./pvp.js";

describe("canPvpAttack", () => {
  const flagged = (id) => ({ id, pkFlag: true });
  const peaceful = (id) => ({ id, pkFlag: false });

  it("allows two flagged, distinct players inside range", () => {
    expect(canPvpAttack(flagged("a"), flagged("b"), 50)).toBe(true);
    expect(canPvpAttack(flagged("a"), flagged("b"), PVP_ATTACK_RANGE)).toBe(true);
  });

  it("refuses when either player has not opted into PK", () => {
    expect(canPvpAttack(flagged("a"), peaceful("b"), 10)).toBe(false);
    expect(canPvpAttack(peaceful("a"), flagged("b"), 10)).toBe(false);
  });

  it("refuses self-targeting", () => {
    expect(canPvpAttack(flagged("a"), flagged("a"), 10)).toBe(false);
  });

  it("refuses out-of-range targets", () => {
    expect(canPvpAttack(flagged("a"), flagged("b"), PVP_ATTACK_RANGE + 1)).toBe(false);
  });

  it("refuses malformed input", () => {
    expect(canPvpAttack(null, flagged("b"), 10)).toBe(false);
    expect(canPvpAttack(flagged("a"), null, 10)).toBe(false);
    expect(canPvpAttack(flagged("a"), flagged("b"), Number.NaN)).toBe(false);
    expect(canPvpAttack({ pkFlag: true }, flagged("b"), 10)).toBe(false);
  });
});

describe("clampPvpDamage", () => {  it("rounds and preserves a sane value", () => {
    expect(clampPvpDamage(18.6)).toBe(19);
  });

  it("caps damage at the ceiling", () => {
    expect(clampPvpDamage(9999)).toBe(PVP_MAX_DAMAGE);
  });

  it("rejects non-positive or non-finite values", () => {
    expect(clampPvpDamage(0)).toBeNull();
    expect(clampPvpDamage(-5)).toBeNull();
    expect(clampPvpDamage(Number.NaN)).toBeNull();
    expect(clampPvpDamage("20")).toBeNull();
    expect(clampPvpDamage(undefined)).toBeNull();
  });
});

describe("dodgeChance", () => {
  const attacker = { x: 0, y: 0 };
  const target = (extra) => ({ x: 300, y: 0, ...extra });

  it("is zero for a target standing still", () => {
    expect(dodgeChance(attacker, target({ vx: 0, vy: 0 }))).toBe(0);
    expect(dodgeChance(attacker, target({ vx: PVP_DODGE_MIN_SPEED - 1, vy: 0 }))).toBe(0);
  });

  it("is maximal when the target runs straight away", () => {
    expect(dodgeChance(attacker, target({ vx: 400, vy: 0 }))).toBeCloseTo(PVP_MAX_DODGE);
  });

  it("never dodges while charging in or sidestepping", () => {
    expect(dodgeChance(attacker, target({ vx: -400, vy: 0 }))).toBe(0);
    expect(dodgeChance(attacker, target({ vx: 0, vy: 400 }))).toBe(0);
  });

  it("scales with how directly the target is fleeing", () => {
    // 45° away: cos(45°) = 0.707 of the ceiling.
    const diagonal = dodgeChance(attacker, target({ vx: 400, vy: 400 }));
    expect(diagonal).toBeGreaterThan(0);
    expect(diagonal).toBeLessThan(PVP_MAX_DODGE);
  });

  it("tolerates malformed input", () => {
    expect(dodgeChance(null, target({ vx: 400 }))).toBe(0);
    expect(dodgeChance(attacker, null)).toBe(0);
    expect(dodgeChance(attacker, target({ vx: "fast" }))).toBe(0);
  });
});

describe("rollDodge", () => {
  const attacker = { x: 0, y: 0 };
  const fleeing = { x: 300, y: 0, vx: 400, vy: 0 };
  const still = { x: 300, y: 0, vx: 0, vy: 0 };

  it("only dodges when the roll lands under the chance", () => {
    expect(rollDodge(attacker, fleeing, 0)).toBe(true);
    expect(rollDodge(attacker, fleeing, 0.99)).toBe(false);
  });

  it("never dodges a stationary target, whatever the roll", () => {
    expect(rollDodge(attacker, still, 0)).toBe(false);
  });

  it("treats a missing or invalid roll as no dodge", () => {
    expect(rollDodge(attacker, fleeing, undefined)).toBe(false);
    expect(rollDodge(attacker, fleeing, Number.NaN)).toBe(false);
  });
});
