import { describe, expect, it } from "vitest";
import { directionFromVelocity } from "./heroDirections.js";

describe("directionFromVelocity", () => {
  it("maps the four cardinal world axes to the correct screen-facing direction", () => {
    // World axes are projected isometrically, so +x renders down-right, +y
    // down-left, -x up-left and -y up-right.
    expect(directionFromVelocity(1, 0)).toBe(1);
    expect(directionFromVelocity(0, 1)).toBe(7);
    expect(directionFromVelocity(-1, 0)).toBe(5);
    expect(directionFromVelocity(0, -1)).toBe(3);
  });

  it("maps the world diagonals to the vertical screen directions", () => {
    // +x-y renders straight right, +x+y straight down, -x-y straight left,
    // -x+y straight up.
    expect(directionFromVelocity(1, -1)).toBe(2);
    expect(directionFromVelocity(1, 1)).toBe(0);
    expect(directionFromVelocity(-1, -1)).toBe(4);
    expect(directionFromVelocity(-1, 1)).toBe(6);
  });

  it("always returns a direction in range", () => {
    for (let a = 0; a < 360; a += 7) {
      const direction = directionFromVelocity(Math.cos(a), Math.sin(a));
      expect(direction).toBeGreaterThanOrEqual(0);
      expect(direction).toBeLessThanOrEqual(7);
    }
  });

  it("handles a zero velocity without throwing", () => {
    expect(directionFromVelocity(0, 0)).toBeGreaterThanOrEqual(0);
    expect(directionFromVelocity(0, 0)).toBeLessThanOrEqual(7);
  });
});
