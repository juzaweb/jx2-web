import { describe, expect, it } from "vitest";
import { bodyFrameForDirection, bodyRowForDirection, bodyTextureFor } from "./heroBody.js";

describe("heroBody", () => {
  it("picks the sheet for each gender and falls back to male", () => {
    expect(bodyTextureFor("male")).toBe("hero-body-male");
    expect(bodyTextureFor("female")).toBe("hero-body-female");
    expect(bodyTextureFor("unknown")).toBe("hero-body-male");
  });

  it("maps the eight directions onto the four sheet rows", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(bodyRowForDirection)).toEqual([
      0, 2, 2, 2, 3, 1, 1, 1
    ]);
  });

  it("wraps out-of-range directions and ignores non-finite input", () => {
    expect(bodyRowForDirection(-2)).toBe(1); // -2 wraps to direction 6 (left)
    expect(bodyRowForDirection(9)).toBe(2); // 9 wraps to direction 1 (down-right)
    expect(bodyRowForDirection(Number.NaN)).toBe(0);
    expect(bodyFrameForDirection(0, Number.NaN)).toBe(0);
  });

  it("advances one walk column per quarter turn", () => {
    expect(bodyFrameForDirection()).toBe(0);
    expect(bodyFrameForDirection(0, 0)).toBe(0);
    expect(bodyFrameForDirection(0, Math.PI / 2)).toBe(1);
    expect(bodyFrameForDirection(0, Math.PI)).toBe(2);
    expect(bodyFrameForDirection(0, (Math.PI * 3) / 2)).toBe(3);
    expect(bodyFrameForDirection(0, Math.PI * 2)).toBe(0);
  });

  it("offsets frames by the direction's row", () => {
    expect(bodyFrameForDirection(4, 0)).toBe(12);
    expect(bodyFrameForDirection(6, Math.PI / 2)).toBe(5);
    expect(bodyFrameForDirection(2, Math.PI)).toBe(10);
  });
});
