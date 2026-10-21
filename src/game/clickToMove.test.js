import { describe, expect, it } from "vitest";
import { MAX_MOVE_DELTA_MS, crossedTarget, shouldSnap, travelStep } from "./clickToMove.js";

describe("travelStep", () => {
  it("converts speed and delta to a per-frame distance", () => {
    expect(travelStep(1000, 16)).toBeCloseTo(16);
    expect(travelStep(1000, 0)).toBe(0);
  });

  it("caps long frames so a hitch cannot jump past the target", () => {
    expect(travelStep(1000, 5000)).toBe((1000 * MAX_MOVE_DELTA_MS) / 1000);
  });

  it("ignores invalid deltas", () => {
    expect(travelStep(1000, NaN)).toBe(0);
    expect(travelStep(1000, -16)).toBe(0);
  });
});

describe("shouldSnap", () => {
  it("keeps the small snap radius for normal frame rates", () => {
    expect(shouldSnap(4, 2)).toBe(true);
    expect(shouldSnap(20, 2)).toBe(false);
  });

  it("snaps when the remaining distance is within one frame of travel", () => {
    expect(shouldSnap(55, 105)).toBe(true);
    expect(shouldSnap(-55, 105)).toBe(true);
  });

  it("prevents the low-fps overshoot oscillation", () => {
    const step = 105;
    expect(shouldSnap(step * 0.5, step)).toBe(true);
  });
});

describe("crossedTarget", () => {
  it("detects a body that stepped past its target", () => {
    expect(crossedTarget(12, -3)).toBe(true);
    expect(crossedTarget(-12, 3)).toBe(true);
  });

  it("ignores legs still approaching the target", () => {
    expect(crossedTarget(40, 12)).toBe(false);
    expect(crossedTarget(-40, -12)).toBe(false);
    expect(crossedTarget(12, 0)).toBe(false);
    expect(crossedTarget(0, -3)).toBe(false);
  });
});
