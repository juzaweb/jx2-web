import { describe, expect, it } from "vitest";
import {
  MARKET_BOUNDS,
  MARKET_BUILDINGS,
  MARKET_GRASS,
  MARKET_NPCS,
  MARKET_PLAZA,
  MARKET_SPAWN,
  MARKET_TREES,
  MARKET_WALKWAY
} from "./marketLayout.js";
import { VEGETATION_SPRITES } from "./marketProps.js";

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;

/** MARKET_BUILDINGS.x/y are facade anchor centres, not top-left corners. */
const footprint = ({ x, y, w, d }) => ({ x: x - w / 2, y: y - d / 2, w, d });

describe("market layout", () => {
  it("keeps the square inside the playable market bounds", () => {
    expect(MARKET_PLAZA.x).toBeGreaterThan(MARKET_BOUNDS.x0);
    expect(MARKET_PLAZA.y).toBeGreaterThan(MARKET_BOUNDS.y0);
    expect(MARKET_PLAZA.x + MARKET_PLAZA.w).toBeLessThan(MARKET_BOUNDS.x1);
    expect(MARKET_PLAZA.y + MARKET_PLAZA.d).toBeLessThan(MARKET_BOUNDS.y1);
  });

  it("spawns the player inside the square", () => {
    expect(MARKET_SPAWN.x).toBeGreaterThan(MARKET_PLAZA.x);
    expect(MARKET_SPAWN.x).toBeLessThan(MARKET_PLAZA.x + MARKET_PLAZA.w);
    expect(MARKET_SPAWN.y).toBeGreaterThan(MARKET_PLAZA.y);
    expect(MARKET_SPAWN.y).toBeLessThan(MARKET_PLAZA.y + MARKET_PLAZA.d);
  });

  it("gives every landmark a unique id and positive footprint", () => {
    const ids = new Set();
    for (const building of MARKET_BUILDINGS) {
      expect(ids.has(building.id)).toBe(false);
      ids.add(building.id);
      expect(building.w).toBeGreaterThan(0);
      expect(building.d).toBeGreaterThan(0);
    }
  });

  it("keeps every shop footprint clear of the others", () => {
    const shops = MARKET_BUILDINGS.filter((building) => building.kind === "shop");
    expect(shops.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < shops.length; i += 1) {
      for (let j = i + 1; j < shops.length; j += 1) {
        expect(overlaps(footprint(shops[i]), footprint(shops[j]))).toBe(false);
      }
    }
  });

  it("keeps every landmark and NPC inside the playable bounds", () => {
    const inside = (x, y) =>
      x > MARKET_BOUNDS.x0 &&
      x < MARKET_BOUNDS.x1 &&
      y > MARKET_BOUNDS.y0 &&
      y < MARKET_BOUNDS.y1;

    for (const { x, y, w, d } of MARKET_BUILDINGS) {
      expect(inside(x - w / 2, y - d / 2)).toBe(true);
      expect(inside(x + w / 2, y + d / 2)).toBe(true);
    }
    for (const { x, y } of MARKET_NPCS) expect(inside(x, y)).toBe(true);
  });

  it("places every shopkeeper in front of its shop", () => {
    for (const npc of MARKET_NPCS) {
      if (!npc.building) continue;
      const building = MARKET_BUILDINGS.find((entry) => entry.id === npc.building);
      expect(building).toBeTruthy();
      expect(Math.abs(npc.x - building.x)).toBeLessThan(building.w / 2);
      expect(npc.y).toBeGreaterThan(building.y);
    }
  });

  it("centers the Dược Sư shopkeeper right at the pharmacy door", () => {
    const npc = MARKET_NPCS.find((entry) => entry.id === "duoc-su");
    const building = MARKET_BUILDINGS.find((entry) => entry.id === "duoc-diem");
    expect(npc).toBeTruthy();
    expect(building).toBeTruthy();
    expect(npc.x).toBe(building.x);
    expect(npc.y).toBeGreaterThan(building.y);
    expect(npc.y - building.y).toBe(120);
  });

  it("configures shop landmarks with matching collision footprint and scale", () => {
    const tapHoa = MARKET_BUILDINGS.find((entry) => entry.id === "tap-hoa");
    const duocDiem = MARKET_BUILDINGS.find((entry) => entry.id === "duoc-diem");
    expect(tapHoa).toBeTruthy();
    expect(duocDiem).toBeTruthy();
    expect(tapHoa.scale).toBe(2.8);
    expect(duocDiem.scale).toBe(2.8);
    expect(tapHoa.w).toBe(2000);
    expect(duocDiem.w).toBe(2000);
  });

  it("uses only known vegetation sprite kinds", () => {
    for (const [, , , kind] of MARKET_TREES) {
      expect(VEGETATION_SPRITES).toHaveProperty(kind);
    }
  });

  it("lays the walkway through the gap between the grocery and the pharmacy", () => {
    const grocery = MARKET_BUILDINGS.find((entry) => entry.id === "tap-hoa");
    const pharmacy = MARKET_BUILDINGS.find((entry) => entry.id === "duoc-diem");
    const groceryBottom = grocery.y + grocery.d / 2;
    const pharmacyTop = pharmacy.y - pharmacy.d / 2;

    expect(MARKET_WALKWAY.w).toBeGreaterThan(0);
    expect(MARKET_WALKWAY.d).toBeGreaterThan(0);
    expect(MARKET_WALKWAY.y).toBeGreaterThanOrEqual(groceryBottom);
    expect(MARKET_WALKWAY.y + MARKET_WALKWAY.d).toBeLessThanOrEqual(pharmacyTop);
    expect(MARKET_WALKWAY.x).toBeGreaterThanOrEqual(MARKET_BOUNDS.x0);
    expect(MARKET_WALKWAY.x + MARKET_WALKWAY.w).toBeLessThanOrEqual(MARKET_BOUNDS.x1);
  });

  it("leads the walkway from the shops into the middle of the city", () => {
    expect(MARKET_SPAWN.x).toBeGreaterThan(MARKET_WALKWAY.x);
    expect(MARKET_SPAWN.x).toBeLessThan(MARKET_WALKWAY.x + MARKET_WALKWAY.w);
    expect(MARKET_SPAWN.y).toBeGreaterThan(MARKET_WALKWAY.y);
    expect(MARKET_SPAWN.y).toBeLessThan(MARKET_WALKWAY.y + MARKET_WALKWAY.d);
  });

  it("keeps trees and grass outside the paved square", () => {
    for (const [x, y] of [...MARKET_TREES, ...MARKET_GRASS]) {
      const inside =
        x > MARKET_PLAZA.x &&
        x < MARKET_PLAZA.x + MARKET_PLAZA.w &&
        y > MARKET_PLAZA.y &&
        y < MARKET_PLAZA.y + MARKET_PLAZA.d;
      expect(inside).toBe(false);
    }
  });
});
