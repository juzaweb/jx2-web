import { describe, expect, it } from "vitest";
import {
  CITY_AVENUES,
  CITY_BOUNDS,
  CITY_BUILDINGS,
  CITY_HOUSES,
  CITY_PAGODAS,
  CITY_PLAZA,
  CITY_TREES,
  WORLD_CONFIG
} from "./worldConfig.js";

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;

const pagodaFootprint = ({ cx, cy, size }) => ({
  x: cx - size / 2,
  y: cy - size / 2,
  w: size,
  d: size
});

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

  it("keeps the plaza inside the walls", () => {
    expect(CITY_PLAZA.x).toBeGreaterThan(CITY_BOUNDS.x0);
    expect(CITY_PLAZA.y).toBeGreaterThan(CITY_BOUNDS.y0);
    expect(CITY_PLAZA.x + CITY_PLAZA.w).toBeLessThan(CITY_BOUNDS.x1);
    expect(CITY_PLAZA.y + CITY_PLAZA.h).toBeLessThan(CITY_BOUNDS.y1);
  });

  it("keeps houses clear of the walls, avenues and landmark buildings", () => {
    const wallThickness = 40;
    const horizontal = {
      x: CITY_BOUNDS.x0,
      y: CITY_AVENUES.horizontal.y,
      w: CITY_BOUNDS.x1 - CITY_BOUNDS.x0,
      d: CITY_AVENUES.horizontal.height
    };
    const vertical = {
      x: CITY_AVENUES.vertical.x,
      y: CITY_BOUNDS.y0,
      w: CITY_AVENUES.vertical.width,
      d: CITY_BOUNDS.y1 - CITY_BOUNDS.y0
    };
    const plaza = { x: CITY_PLAZA.x, y: CITY_PLAZA.y, w: CITY_PLAZA.w, d: CITY_PLAZA.h };
    const pagodas = CITY_PAGODAS.map(pagodaFootprint);

    const ids = new Set();
    for (const house of CITY_HOUSES) {
      expect(ids.has(house.id)).toBe(false);
      ids.add(house.id);
      expect(house.x).toBeGreaterThanOrEqual(CITY_BOUNDS.x0 + wallThickness);
      expect(house.y).toBeGreaterThanOrEqual(CITY_BOUNDS.y0 + wallThickness);
      expect(house.x + house.w).toBeLessThanOrEqual(CITY_BOUNDS.x1 - wallThickness);
      expect(house.y + house.d).toBeLessThanOrEqual(CITY_BOUNDS.y1 - wallThickness);
      expect(overlaps(house, horizontal)).toBe(false);
      expect(overlaps(house, vertical)).toBe(false);
      expect(overlaps(house, plaza)).toBe(false);
      pagodas.forEach((pagoda) => {
        expect(overlaps(house, pagoda)).toBe(false);
      });
      CITY_BUILDINGS.forEach((building) => {
        expect(overlaps(house, building)).toBe(false);
      });
    }
  });

  it("keeps trees out of houses, landmarks and the plaza", () => {
    const plaza = { x: CITY_PLAZA.x, y: CITY_PLAZA.y, w: CITY_PLAZA.w, d: CITY_PLAZA.h };
    const pointIn = (x, y, rect) =>
      x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.d;

    for (const [x, y] of CITY_TREES) {
      CITY_HOUSES.forEach((house) => {
        expect(pointIn(x, y, house)).toBe(false);
      });
      CITY_BUILDINGS.forEach((building) => {
        expect(pointIn(x, y, building)).toBe(false);
      });
      expect(pointIn(x, y, plaza)).toBe(false);
    }
  });
});
