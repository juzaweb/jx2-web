import { describe, it, expect } from "vitest";
import { toIso, fromIso, isoDepth, isoBounds } from "./isoProjection.js";

describe("screen projection", () => {
  it("keeps the ground origin fixed", () => {
    expect(toIso(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("maps ground coordinates 1:1 to screen coordinates", () => {
    expect(toIso(640, 620)).toEqual({ x: 640, y: 620 });
    expect(toIso(123.5, 987.25)).toEqual({ x: 123.5, y: 987.25 });
  });

  it("round-trips ground -> screen -> ground", () => {
    const samples = [
      [0, 0],
      [640, 620],
      [2200, 1250],
      [123.5, 987.25]
    ];
    for (const [x, y] of samples) {
      const screen = toIso(x, y);
      const ground = fromIso(screen.x, screen.y);
      expect(ground.x).toBeCloseTo(x, 6);
      expect(ground.y).toBeCloseTo(y, 6);
    }
  });

  it("sorts depth by ground y", () => {
    expect(isoDepth(10, 10)).toBe(10);
    expect(isoDepth(0, 19)).toBe(19);
    expect(isoDepth(10, 10)).toBeLessThan(isoDepth(0, 19));
  });

  it("computes a screen-aligned bounding box for a ground rectangle", () => {
    expect(isoBounds(2200, 1250)).toEqual({ minX: 0, minY: 0, maxX: 2200, maxY: 1250 });
  });
});
