import { describe, expect, it } from "vitest";
import { clampToRange } from "./aim.js";

describe("clampToRange", () => {
  const origin = { x: 100, y: 200 };

  it("leaves a point inside the range untouched", () => {
    expect(clampToRange(origin, { x: 400, y: 200 }, 600)).toEqual({ x: 400, y: 200 });
    expect(clampToRange(origin, { x: 700, y: 200 }, 600)).toEqual({ x: 700, y: 200 });
  });

  it("pulls a far point back along the same direction", () => {
    expect(clampToRange(origin, { x: 1000, y: 200 }, 600)).toEqual({ x: 700, y: 200 });
    const diagonal = clampToRange(origin, { x: 1000, y: 1000 }, 600);
    expect(Math.hypot(diagonal.x - origin.x, diagonal.y - origin.y)).toBeCloseTo(600);
    expect((diagonal.x - origin.x) / (diagonal.y - origin.y)).toBeCloseTo(900 / 800);
  });

  it("returns the origin for a point on the origin or a zero range", () => {
    expect(clampToRange(origin, { x: 100, y: 200 }, 600)).toEqual({ x: 100, y: 200 });
    expect(clampToRange(origin, { x: 400, y: 200 }, 0)).toEqual({ x: 100, y: 200 });
    expect(clampToRange(origin, { x: 400, y: 200 }, -10)).toEqual({ x: 100, y: 200 });
  });
});
