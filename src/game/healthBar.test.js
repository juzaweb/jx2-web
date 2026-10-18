import { describe, it, expect } from "vitest";
import {
  HEALTH_COLOR_DANGER,
  HEALTH_COLOR_HEALTHY,
  HEALTH_COLOR_WARN,
  HEALTH_DANGER_RATIO,
  HEALTH_WARN_RATIO,
  healthBarStyle
} from "./healthBar.js";

describe("healthBarStyle", () => {
  it("fills proportionally to the health fraction", () => {
    expect(healthBarStyle(50, 100).ratio).toBe(0.5);
    expect(healthBarStyle(100, 100).ratio).toBe(1);
    expect(healthBarStyle(25, 100).ratio).toBe(0.25);
  });

  it("clamps out-of-range health into [0, 1]", () => {
    expect(healthBarStyle(-30, 100).ratio).toBe(0);
    expect(healthBarStyle(260, 100).ratio).toBe(1);
  });

  it("returns an empty bar instead of dividing by a non-positive maxHp", () => {
    expect(healthBarStyle(50, 0).ratio).toBe(0);
    expect(healthBarStyle(50, -10).ratio).toBe(0);
    expect(healthBarStyle(50, Number.NaN).ratio).toBe(0);
  });

  it("treats non-finite hp as empty", () => {
    expect(healthBarStyle(Number.NaN, 100).ratio).toBe(0);
    expect(healthBarStyle(undefined, 100).ratio).toBe(0);
  });

  it("shifts colour from green to amber to red as health drops", () => {
    expect(healthBarStyle(100, 100).color).toBe(HEALTH_COLOR_HEALTHY);
    expect(healthBarStyle(HEALTH_WARN_RATIO * 100 + 1, 100).color).toBe(HEALTH_COLOR_HEALTHY);
    expect(healthBarStyle(HEALTH_WARN_RATIO * 100, 100).color).toBe(HEALTH_COLOR_WARN);
    expect(healthBarStyle(HEALTH_DANGER_RATIO * 100, 100).color).toBe(HEALTH_COLOR_DANGER);
    expect(healthBarStyle(1, 100).color).toBe(HEALTH_COLOR_DANGER);
  });
});
