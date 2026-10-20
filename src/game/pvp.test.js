import { describe, it, expect } from "vitest";
import { canPvpAttack, clampPvpDamage, PVP_ATTACK_RANGE, PVP_MAX_DAMAGE } from "./pvp.js";

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

describe("clampPvpDamage", () => {
  it("rounds and preserves a sane value", () => {
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
