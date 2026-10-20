import { describe, expect, it } from "vitest";
import { directionFromVelocity } from "./heroDirections.js";

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
