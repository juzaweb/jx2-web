import { describe, expect, it } from "vitest";
import { HERO_PUNCH, punchFrameForDirection, punchTextureFor } from "./heroPunch.js";

describe("heroPunch", () => {
  it("picks punch texture for each gender and falls back to male", () => {
    expect(punchTextureFor("male")).toBe("hero-punch-male");
    expect(punchTextureFor("female")).toBe("hero-punch-female");
    expect(punchTextureFor("unknown")).toBe("hero-punch-male");
  });

  it("calculates frame index for direction and punch step", () => {
    // Row 0 (Down/Front) * 4 cols + step
    expect(punchFrameForDirection(0, 0)).toBe(0);
    expect(punchFrameForDirection(0, 1)).toBe(1);
    expect(punchFrameForDirection(0, 2)).toBe(2);
    expect(punchFrameForDirection(0, 3)).toBe(3);

    // Row 1 (Left) * 4 cols + step
    expect(punchFrameForDirection(6, 0)).toBe(4);
    expect(punchFrameForDirection(6, 1)).toBe(5);

    // Row 2 (Right) * 4 cols + step
    expect(punchFrameForDirection(2, 0)).toBe(8);
    expect(punchFrameForDirection(2, 2)).toBe(10);

    // Row 3 (Up/Back) * 4 cols + step
    expect(punchFrameForDirection(4, 0)).toBe(12);
    expect(punchFrameForDirection(4, 3)).toBe(15);
  });

  it("clamps frame steps and handles invalid numbers", () => {
    expect(punchFrameForDirection(0, -5)).toBe(0);
    expect(punchFrameForDirection(0, 99)).toBe(3);
    expect(punchFrameForDirection(0, Number.NaN)).toBe(0);
  });

  it("has correct sprite sheet geometry properties", () => {
    expect(HERO_PUNCH.frameWidth).toBe(128);
    expect(HERO_PUNCH.frameHeight).toBe(160);
    expect(HERO_PUNCH.columns).toBe(4);
    expect(HERO_PUNCH.rows).toBe(4);
  });
});
