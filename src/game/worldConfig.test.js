import { describe, expect, it } from "vitest";
import {
  CITY_AVENUES,
  CITY_BOUNDS,
  CITY_BUILDINGS,
  WORLD_CONFIG
} from "./worldConfig.js";

describe("world layout config", () => {
  it("keeps the city inside the world bounds", () => {
    expect(CITY_BOUNDS.x0).toBeGreaterThanOrEqual(0);
    expect(CITY_BOUNDS.y0).toBeGreaterThanOrEqual(0);
    expect(CITY_BOUNDS.x1).toBeLessThanOrEqual(WORLD_CONFIG.width);
    expect(CITY_BOUNDS.y1).toBeLessThanOrEqual(WORLD_CONFIG.height);
    expect(WORLD_CONFIG.cityBounds).toBe(CITY_BOUNDS);
  });

  it("keeps every building footprint centred inside the walls with unique ids", () => {
    const ids = new Set();
    for (const building of CITY_BUILDINGS) {
      expect(ids.has(building.id)).toBe(false);
      ids.add(building.id);
      expect(building.w).toBeGreaterThan(0);
      expect(building.d).toBeGreaterThan(0);
      const cx = building.x + building.w / 2;
      const cy = building.y + building.d / 2;
      expect(cx).toBeGreaterThan(CITY_BOUNDS.x0);
      expect(cx).toBeLessThan(CITY_BOUNDS.x1);
      expect(cy).toBeGreaterThan(CITY_BOUNDS.y0);
      expect(cy).toBeLessThan(CITY_BOUNDS.y1);
    }
  });

  it("keeps the avenues inside the city", () => {
    const { horizontal, vertical } = CITY_AVENUES;
    expect(horizontal.y).toBeGreaterThanOrEqual(CITY_BOUNDS.y0);
    expect(horizontal.y + horizontal.height).toBeLessThanOrEqual(CITY_BOUNDS.y1);
    expect(vertical.x).toBeGreaterThanOrEqual(CITY_BOUNDS.x0);
    expect(vertical.x + vertical.width).toBeLessThanOrEqual(CITY_BOUNDS.x1);
  });
});
