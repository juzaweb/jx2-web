import { describe, it, expect, vi } from "vitest";
import { createHealthBar, layoutHealthBar } from "./healthBarView.js";
import { HEALTH_BAR_HEIGHT, HEALTH_BAR_WIDTH, HEALTH_COLOR_HEALTHY } from "./healthBar.js";

/** Minimal stand-in for a Phaser rectangle, recording the calls made on it. */
const makeRect = () => {
  const rect = {
    width: 0,
    height: 0,
    setOrigin: vi.fn(() => rect),
    setDepth: vi.fn(() => rect),
    setStrokeStyle: vi.fn(() => rect),
    setPosition: vi.fn(() => rect),
    setFillStyle: vi.fn(() => rect),
    // Phaser only redraws a Rectangle through setSize; mirror that here so the
    // tests fail if the implementation goes back to assigning `.width`.
    setSize: vi.fn((width, height) => {
      rect.width = width;
      rect.height = height;
      return rect;
    })
  };
  return rect;
};

const makeScene = () => {
  const rects = [];
  return {
    rects,
    add: {
      rectangle: vi.fn((x, y, width, height) => {
        const rect = makeRect();
        rect.x = x;
        rect.y = y;
        rect.width = width;
        rect.height = height;
        rects.push(rect);
        return rect;
      })
    }
  };
};

describe("createHealthBar", () => {
  it("creates a back plate and a fill sized from the shared geometry", () => {
    const scene = makeScene();
    const { back, fill } = createHealthBar(scene, 100, 200);

    expect(scene.rects).toHaveLength(2);
    expect(back.width).toBe(HEALTH_BAR_WIDTH);
    expect(back.height).toBe(HEALTH_BAR_HEIGHT);
    expect(fill.width).toBeLessThan(HEALTH_BAR_WIDTH);
    expect(fill.height).toBeLessThan(HEALTH_BAR_HEIGHT);
  });

  it("places the bar above the anchor and keeps the fill left-anchored", () => {
    const scene = makeScene();
    const { back, fill } = createHealthBar(scene, 100, 200);

    expect(back.x).toBe(100);
    expect(back.y).toBeLessThan(200);
    expect(fill.x).toBeLessThan(100);
    expect(fill.y).toBe(back.y);
  });
});

describe("layoutHealthBar", () => {
  it("sizes the fill and recolours it from the health fraction", () => {
    const bar = { back: makeRect(), fill: makeRect() };
    const fullFillWidth = HEALTH_BAR_WIDTH - 4;

    layoutHealthBar(bar, 100, 200, 200, 50, 100);

    expect(bar.fill.setSize).toHaveBeenCalledWith(
      expect.closeTo(fullFillWidth * 0.5),
      expect.any(Number)
    );
    expect(bar.fill.width).toBeCloseTo(fullFillWidth * 0.5);
    expect(bar.fill.setFillStyle).toHaveBeenCalledTimes(1);
    expect(bar.back.setPosition).toHaveBeenCalledWith(100, expect.any(Number));
  });

  it("sorts the bar by the depth base, not the bobbing overhead Y", () => {
    const bar = { back: makeRect(), fill: makeRect() };

    // overheadY (195) differs from depthBase (200); depth must follow the base
    layoutHealthBar(bar, 100, 195, 200, 100, 100);

    expect(bar.back.setDepth).toHaveBeenCalledWith(301);
    expect(bar.fill.setDepth).toHaveBeenCalledWith(302);
  });

  it("draws a full bar on join", () => {
    const bar = { back: makeRect(), fill: makeRect() };

    layoutHealthBar(bar, 0, 0, 0, 100, 100);

    expect(bar.fill.width).toBe(HEALTH_BAR_WIDTH - 4);
    expect(bar.fill.setFillStyle).toHaveBeenCalledWith(HEALTH_COLOR_HEALTHY);
  });

  it("no-ops when either rectangle is missing", () => {
    expect(() => layoutHealthBar({ back: null, fill: null }, 0, 0, 0, 100, 100)).not.toThrow();
    expect(() => layoutHealthBar(undefined, 0, 0, 0, 100, 100)).not.toThrow();
  });
});
