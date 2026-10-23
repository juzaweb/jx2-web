import { describe, expect, it } from "vitest";
import { directionFromVelocity, directionVector } from "./heroDirections.js";

describe("directionFromVelocity", () => {
  it("maps the four cardinal axes to four facing directions", () => {
    expect(directionFromVelocity(1, 0)).toBe(2); // right
    expect(directionFromVelocity(0, 1)).toBe(0); // down
    expect(directionFromVelocity(-1, 0)).toBe(6); // left
    expect(directionFromVelocity(0, -1)).toBe(4); // up
  });

  it("never returns a diagonal facing", () => {
    expect([0, 2, 4, 6]).toContain(directionFromVelocity(1, -1));
    expect([0, 2, 4, 6]).toContain(directionFromVelocity(1, 1));
    expect([0, 2, 4, 6]).toContain(directionFromVelocity(-1, -1));
    expect([0, 2, 4, 6]).toContain(directionFromVelocity(-1, 1));
  });

  it("picks the dominant axis for mixed input", () => {
    expect(directionFromVelocity(3, 1)).toBe(2);
    expect(directionFromVelocity(1, 3)).toBe(0);
    expect(directionFromVelocity(-3, 1)).toBe(6);
    expect(directionFromVelocity(1, -3)).toBe(4);
  });

  it("handles a zero velocity without throwing", () => {
    expect(directionFromVelocity(0, 0)).toBeGreaterThanOrEqual(0);
    expect(directionFromVelocity(0, 0)).toBeLessThanOrEqual(7);
  });
});

describe("directionVector", () => {
  it("returns unit vectors for the cardinal and diagonal facings", () => {
    expect(directionVector(0)).toEqual({ x: 0, y: 1 });
    expect(directionVector(2)).toEqual({ x: 1, y: 0 });
    expect(directionVector(4)).toEqual({ x: 0, y: -1 });
    expect(directionVector(6)).toEqual({ x: -1, y: 0 });
    const diagonal = directionVector(1);
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
    expect(diagonal.y).toBeCloseTo(Math.SQRT1_2);
  });

  it("normalises out-of-range and fractional directions", () => {
    expect(directionVector(8)).toEqual({ x: 0, y: 1 });
    expect(directionVector(-2)).toEqual({ x: -1, y: 0 });
    expect(directionVector(1.6)).toEqual(directionVector(2));
  });
});
