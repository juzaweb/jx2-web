import { describe, expect, it } from "vitest";
import {
  MARKET_BOUNDS,
  MARKET_BUILDINGS,
  MARKET_LANTERNS,
  MARKET_PLAZA,
  MARKET_PROPS,
  MARKET_SPAWN,
  MARKET_TREES
} from "./marketLayout.js";
import { NPC_DATA } from "./npcData.js";

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

  it("keeps the two shops clear of each other", () => {
    const shops = MARKET_BUILDINGS.filter((building) => building.kind === "shop");
    expect(shops).toHaveLength(2);
    expect(overlaps(footprint(shops[0]), footprint(shops[1]))).toBe(false);
  });

  it("keeps every landmark, prop and lantern inside the playable bounds", () => {
    const inside = (x, y) =>
      x > MARKET_BOUNDS.x0 &&
      x < MARKET_BOUNDS.x1 &&
      y > MARKET_BOUNDS.y0 &&
      y < MARKET_BOUNDS.y1;

    for (const { x, y, w, d } of MARKET_BUILDINGS) {
      expect(inside(x - w / 2, y - d / 2)).toBe(true);
      expect(inside(x + w / 2, y + d / 2)).toBe(true);
    }
    for (const { x, y } of MARKET_PROPS) expect(inside(x, y)).toBe(true);
    for (const [x, y] of MARKET_LANTERNS) expect(inside(x, y)).toBe(true);
  });

  it("keeps every NPC inside the playable bounds", () => {
    for (const npc of NPC_DATA) {
      expect(npc.x).toBeGreaterThan(MARKET_BOUNDS.x0);
      expect(npc.x).toBeLessThan(MARKET_BOUNDS.x1);
      expect(npc.y).toBeGreaterThan(MARKET_BOUNDS.y0);
      expect(npc.y).toBeLessThan(MARKET_BOUNDS.y1);
    }
  });

  it("keeps trees outside the paved square", () => {
    for (const [x, y] of MARKET_TREES) {
      const inside =
        x > MARKET_PLAZA.x &&
        x < MARKET_PLAZA.x + MARKET_PLAZA.w &&
        y > MARKET_PLAZA.y &&
        y < MARKET_PLAZA.y + MARKET_PLAZA.d;
      expect(inside).toBe(false);
    }
  });
});
