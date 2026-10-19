import { describe, expect, it } from "vitest";
import { buildHero, poseFor } from "./heroRig.js";
import { HERO_DIRECTIONS } from "./heroDirections.js";

describe("poseFor", () => {
  it("turns the cardinal directions into the right pose parameters", () => {
    expect(poseFor(0)).toEqual({ side: 0, back: 0, depth: 0 }); // front
    const right = poseFor(2);
    expect(right.side).toBeCloseTo(1);
    expect(right.back).toBeCloseTo(0.5);
    expect(right.depth).toBeCloseTo(1);
    expect(poseFor(4).back).toBeCloseTo(1); // away
    expect(poseFor(6).side).toBeCloseTo(-1); // left
  });

  it("wraps out-of-range indices into 0..7", () => {
    expect(poseFor(8)).toEqual(poseFor(0));
    expect(poseFor(-1)).toEqual(poseFor(7));
  });
});

describe("buildHero", () => {
  it("draws a non-empty rig for every direction", () => {
    for (let d = 0; d < HERO_DIRECTIONS; d++) {
      const parts = buildHero({ direction: d });
      expect(parts.length).toBeGreaterThan(10);
      expect(parts.every((p) => typeof p.kind === "string")).toBe(true);
    }
  });

  it("adds one extra layer per equipped slot", () => {
    const base = buildHero({ direction: 0 }).length;
    expect(buildHero({ direction: 0, equipment: { helmet: "x" } }).length).toBeGreaterThan(base);
    const full = buildHero({
      direction: 0,
      equipment: { armor: "x", boots: "x", helmet: "x", accessory: "x", weapon: "x" }
    }).length;
    expect(full).toBeGreaterThan(buildHero({ direction: 0, equipment: { helmet: "x" } }).length);
  });

  it("ignores empty slots", () => {
    const base = buildHero({ direction: 0 }).length;
    expect(buildHero({ direction: 0, equipment: { helmet: null, armor: undefined } }).length).toBe(base);
  });
});
