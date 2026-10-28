import { describe, expect, it } from "vitest";

import { factionCityBuildings, factionCityNpcs } from "./factionCityLayout.js";
import { MARKET_NPCS } from "./marketLayout.js";
import { CITY_NPC_IDENTITIES } from "./npcRoster.js";
import { QUESTS } from "./quests/catalog.js";

/** Ground rectangle of a city map (both capitals share the same square). */
const CITY_BOUNDS = { x0: 0, y0: 0, x1: 8000, y1: 8000 };

/** Collision footprint of a building, matching `WorldManager.drawBuildings`. */
const collisionBox = ({ x, y, w }) => ({
  x0: x - (w * 0.9) / 2,
  x1: x + (w * 0.9) / 2,
  y0: y - 220,
  y1: y
});

/** Visual footprint, used to keep shops from intersecting each other. */
const footprint = ({ x, y, w, d }) => ({ x0: x - w / 2, x1: x + w / 2, y0: y - d / 2, y1: y + d / 2 });

const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

const inside = (x, y) => x > CITY_BOUNDS.x0 && x < CITY_BOUNDS.x1 && y > CITY_BOUNDS.y0 && y < CITY_BOUNDS.y1;

/** Every NPC id the newbie chain names. */
const questNpcIds = () => {
  const ids = new Set();
  for (const quest of QUESTS) {
    ids.add(quest.giver);
    ids.add(quest.turnIn);
    for (const objective of quest.objectives) {
      for (const target of objective.targets) ids.add(target.npcId);
    }
  }
  return ids;
};

describe("faction city layout", () => {
  it("prefixes building ids per city while keeping NPC ids stable", () => {
    for (const [prefix, city] of [
      ["thuc", "Thục"],
      ["nguy", "Ngụy"]
    ]) {
      const buildings = factionCityBuildings(prefix);
      const ids = buildings.map((building) => building.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id.startsWith(`${prefix}-`), `${city} building ${id}`).toBe(true);

      const npcs = factionCityNpcs(prefix);
      const npcIds = npcs.map((npc) => npc.id);
      expect(new Set(npcIds).size).toBe(npcIds.length);
      expect(new Set(npcIds)).toEqual(new Set(MARKET_NPCS.map((npc) => npc.id)));
    }
  });

  it("places every newbie-quest NPC in both capitals", () => {
    const required = questNpcIds();
    for (const prefix of ["thuc", "nguy"]) {
      const ids = new Set(factionCityNpcs(prefix).map((npc) => npc.id));
      for (const npcId of required) expect(ids.has(npcId), `${prefix} must place ${npcId}`).toBe(true);
    }
  });

  it("takes every name, tint and role from the shared identity roster", () => {
    for (const prefix of ["thuc", "nguy"]) {
      for (const npc of factionCityNpcs(prefix)) {
        const identity = CITY_NPC_IDENTITIES[npc.id];
        expect(identity, npc.id).toBeTruthy();
        expect(npc).toMatchObject(identity);
      }
    }
  });

  it("puts every shopkeeper in front of a shop that exists on the same map", () => {
    for (const prefix of ["thuc", "nguy"]) {
      const buildings = new Map(factionCityBuildings(prefix).map((b) => [b.id, b]));
      for (const npc of factionCityNpcs(prefix)) {
        if (!npc.building) {
          expect(npc.shop, `${npc.id} without a building must not sell`).toBeUndefined();
          continue;
        }
        const building = buildings.get(npc.building);
        expect(building, `${npc.id} -> ${npc.building}`).toBeTruthy();
        expect(npc.x).toBe(building.x);
        expect(npc.y).toBeGreaterThan(building.y);
        expect(npc.y - building.y).toBeLessThan(building.d);
      }
    }
  });

  it("keeps every shop and NPC inside the city and clear of each other", () => {
    for (const prefix of ["thuc", "nguy"]) {
      const buildings = factionCityBuildings(prefix);
      const npcs = factionCityNpcs(prefix);

      for (const building of buildings) {
        const box = footprint(building);
        expect(inside(box.x0, box.y0), `${building.id} top-left`).toBe(true);
        expect(inside(box.x1, box.y1), `${building.id} bottom-right`).toBe(true);
      }

      for (let i = 0; i < buildings.length; i += 1) {
        for (let j = i + 1; j < buildings.length; j += 1) {
          expect(
            overlaps(footprint(buildings[i]), footprint(buildings[j])),
            `${buildings[i].id} overlaps ${buildings[j].id}`
          ).toBe(false);
        }
      }

      for (const npc of npcs) {
        expect(inside(npc.x, npc.y), `${npc.id} must be inside the city`).toBe(true);
        for (const building of buildings) {
          const box = collisionBox(building);
          const insideBuilding =
            npc.x > box.x0 && npc.x < box.x1 && npc.y > box.y0 && npc.y < box.y1;
          expect(insideBuilding, `${npc.id} must not stand inside ${building.id}`).toBe(false);
        }
      }
    }
  });

  it("keeps one pharmacy counter per capital for the Dược Sư", () => {
    for (const prefix of ["thuc", "nguy"]) {
      const pharmacy = factionCityNpcs(prefix).find((npc) => npc.id === "duoc-su");
      expect(pharmacy?.shop).toBe("pharmacy");
      expect(pharmacy?.sprite).toBe("npc-duoc");
      expect(pharmacy?.building).toBe(`${prefix}-duoc-diem`);
    }
  });

  it("rejects a missing city prefix instead of producing broken ids", () => {
    expect(() => factionCityBuildings("")).toThrow(TypeError);
    expect(() => factionCityNpcs()).toThrow(TypeError);
  });
});
