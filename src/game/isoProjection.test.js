import { describe, it, expect } from "vitest";
import { toIso, fromIso, isoDepth, isoBounds, ISO_RATIO } from "./isoProjection.js";

describe("isoProjection", () => {
  it("keeps the ground origin fixed", () => {
    expect(toIso(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("renders a tile as a 2:1 diamond", () => {
    const a = toIso(0, 0);
    const b = toIso(64, 0);
    const c = toIso(64, 64);
    const d = toIso(0, 64);

    const width = Math.abs(b.x - d.x);
    const height = Math.abs(c.y - a.y);
    expect(width / height).toBe(ISO_RATIO);
    expect(b.y).toBeGreaterThan(a.y);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("round-trips ground -> iso -> ground", () => {
    const samples = [
      [0, 0],
      [640, 620],
      [2200, 1250],
      [123.5, 987.25]
    ];
    for (const [x, y] of samples) {
      const iso = toIso(x, y);
      const ground = fromIso(iso.x, iso.y);
      expect(ground.x).toBeCloseTo(x, 6);
      expect(ground.y).toBeCloseTo(y, 6);
    }
  });

  it("sorts depth by ground (x + y)", () => {
    expect(isoDepth(10, 10)).toBeGreaterThan(isoDepth(0, 19));
    expect(isoDepth(5, 5)).toBe(isoDepth(0, 10));
  });

  it("computes a diamond bounding box for a ground rectangle", () => {
    const b = isoBounds(2200, 1250);
    expect(b.minX).toBeLessThan(0);
    expect(b.maxX).toBeGreaterThan(0);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBeCloseTo((2200 + 1250) / 4, 6);
  });
});
