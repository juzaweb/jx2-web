import { describe, expect, it } from "vitest";

import { MONSTERS } from "../enemyCatalog.js";
import {
  DEFAULT_MAP_ID,
  MAPS,
  MAP_IDS,
  findPortal,
  getMap,
  isInsideMap,
  isKnownMap,
  mapSize,
  mapWorldConfig
} from "./mapRegistry.js";
import { isInsideRect, portalAt, stepPortalTrigger } from "./portals.js";

/** Ground rectangle of a map, as a portal-style rect. */
const boundsRect = (map) => ({
  x: map.bounds.x0,
  y: map.bounds.y0,
  w: map.bounds.x1 - map.bounds.x0,
  h: map.bounds.y1 - map.bounds.y0
});

describe("map registry", () => {
  it("registers the market and the eastern town", () => {
    expect(MAP_IDS).toEqual(["market", "dong-mon-thanh"]);
    expect(isKnownMap("dong-mon-thanh")).toBe(true);
    expect(isKnownMap("nowhere")).toBe(false);
    expect(getMap("nowhere").id).toBe(DEFAULT_MAP_ID);
  });

  it("keeps every spawn point inside the walkable rectangle", () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      expect(isInsideMap(map, map.spawn.x, map.spawn.y)).toBe(true);
    }
  });

  it("keeps every portal inside its map and pointing at a real destination", () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      for (const portal of map.portals || []) {
        expect(isInsideRect(boundsRect(map), portal.rect.x, portal.rect.y)).toBe(true);
        expect(
          isInsideRect(boundsRect(map), portal.rect.x + portal.rect.w, portal.rect.y + portal.rect.h)
        ).toBe(true);

        expect(isKnownMap(portal.targetMapId)).toBe(true);
        const target = getMap(portal.targetMapId);
        expect(isInsideMap(target, portal.targetSpawn.x, portal.targetSpawn.y)).toBe(true);
        expect(target).not.toBe(map);
      }
    }
  });

  it("never lands the hero inside a portal, which would bounce them back", () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      for (const portal of map.portals || []) {
        const target = getMap(portal.targetMapId);
        for (const targetPortal of target.portals || []) {
          expect(
            isInsideRect(targetPortal.rect, portal.targetSpawn.x, portal.targetSpawn.y)
          ).toBe(false);
        }
      }
    }
  });

  it("keeps the default spawn clear of every portal", () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      expect(portalAt(map, map.spawn.x, map.spawn.y)).toBeNull();
    }
  });

  it("keeps gates inside the map", () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      const bounds = boundsRect(map);
      for (const gate of map.gates || []) {
        expect(isInsideRect(bounds, gate.x, gate.y)).toBe(true);
      }
    }
  });

  it("places every monster spawn inside its level band", () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      const ids = (map.enemySpawns || []).map((spawn) => spawn.id);
      expect(new Set(ids).size).toBe(ids.length);

      for (const spawn of map.enemySpawns || []) {
        const monster = MONSTERS[spawn.monsterId];
        expect(monster, `${id}/${spawn.monsterId} must exist in the catalog`).toBeTruthy();

        if (!map.allowOutOfBoundsSpawns) {
          expect(isInsideMap(map, spawn.x, spawn.y), `${id} spawn ${spawn.id}`).toBe(true);
        }

        const zones = (map.zones || []).filter(
          (zone) =>
            spawn.x >= zone.bounds.x0 &&
            spawn.x <= zone.bounds.x1 &&
            spawn.y >= zone.bounds.y0 &&
            spawn.y <= zone.bounds.y1
        );

        if (map.zones?.length) {
          expect(zones, `${id} spawn ${spawn.id} must land in a zone`).toHaveLength(1);
          const zone = zones[0];
          expect(monster.level).toBeGreaterThanOrEqual(zone.minLevel);
          expect(monster.level).toBeLessThanOrEqual(zone.maxLevel);
        }
      }
    }
  });

  it("spreads a camp's monsters out and ships the same pack size per species", () => {
    const map = MAPS["dong-mon-thanh"];
    const bySpecies = new Map();

    for (const spawn of map.enemySpawns) {
      const pack = bySpecies.get(spawn.monsterId) || [];
      pack.push(spawn);
      bySpecies.set(spawn.monsterId, pack);
    }

    // A camp that silently drops or duplicates monsters would show up here.
    const sizes = [...bySpecies.values()].map((pack) => pack.length);
    expect(new Set(sizes).size).toBe(1);

    for (const [monsterId, pack] of bySpecies) {
      for (let i = 0; i < pack.length; i++) {
        for (let j = i + 1; j < pack.length; j++) {
          const gap = Math.hypot(pack[i].x - pack[j].x, pack[i].y - pack[j].y);
          // 300 is below the authored 400 gap but still clears the health bar
          // (190 px), so a data nudge doesn't break the build and a pile does.
          expect(gap, `${monsterId} #${pack[i].id} vs #${pack[j].id}`).toBeGreaterThanOrEqual(300);
        }
      }
    }
  });

  it("puts the weakest camps nearest the entrance and the deadliest deepest", () => {
    // Walking in from the entrance should always be a step up in level, never a
    // wall of level-29s around the first clearing.
    const map = MAPS["dong-mon-thanh"];
    const bySpecies = new Map();

    for (const spawn of map.enemySpawns) {
      const distance = Math.hypot(spawn.x - map.spawn.x, spawn.y - map.spawn.y);
      const entry = bySpecies.get(spawn.monsterId) || {
        level: MONSTERS[spawn.monsterId].level,
        nearest: Infinity
      };
      entry.nearest = Math.min(entry.nearest, distance);
      bySpecies.set(spawn.monsterId, entry);
    }

    const ordered = [...bySpecies.values()].sort((a, b) => a.level - b.level);
    for (let i = 1; i < ordered.length; i++) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      expect(
        current.nearest,
        `Lv${current.level} camps must sit deeper than Lv${previous.level} ones`
      ).toBeGreaterThan(previous.nearest);
    }
  });

  it("keeps buildings out of the low-level hunting belt", () => {
    // The outskirts are woodland: a shop inside a level 1-10 zone would be a town
    // building dropped in the middle of a forest.
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      const lowZones = (map.zones || []).filter((zone) => zone.maxLevel <= 10);

      for (const building of map.buildings || []) {
        for (const zone of lowZones) {
          const inside =
            building.x >= zone.bounds.x0 &&
            building.x <= zone.bounds.x1 &&
            building.y >= zone.bounds.y0 &&
            building.y <= zone.bounds.y1;
          expect(inside, `${id}/${building.id} must not sit in ${zone.id}`).toBe(false);
        }
      }
    }
  });

  it("builds a minimap descriptor from the active map only", () => {
    const market = mapWorldConfig("market");
    const town = mapWorldConfig("dong-mon-thanh");

    expect(market.id).toBe("market");
    expect(town.id).toBe("dong-mon-thanh");
    expect(market.width).toBe(mapSize("market").width);
    expect(town.cityBounds).toEqual(MAPS["dong-mon-thanh"].bounds);
    // The descriptor mirrors the map, so a map with no buildings/walls (the
    // forest) produces an empty descriptor rather than leaking the market's.
    expect(town.buildings).toEqual(MAPS["dong-mon-thanh"].buildings);
    expect(market.buildings.length).toBeGreaterThan(0);
    expect(town.portals).toEqual(MAPS["dong-mon-thanh"].portals);
  });

  it("resolves portals by id for server-side travel validation", () => {
    expect(findPortal("market", "east-gate")?.targetMapId).toBe("dong-mon-thanh");
    expect(findPortal("dong-mon-thanh", "west-gate")?.targetMapId).toBe("market");
    expect(findPortal("market", "west-gate")).toBeNull();
    expect(findPortal("market", "missing")).toBeNull();
  });
});

describe("portal trigger state machine", () => {
  const portal = { id: "east-gate", rect: { x: 0, y: 0, w: 100, h: 100 } };

  it("fires once on entry and not again while the hero stays inside", () => {
    let state = { insidePortalId: null, armed: true, lockedUntil: 0 };

    const first = stepPortalTrigger(state, portal, 1000);
    expect(first.portal).toBe(portal);
    state = first.state;

    const second = stepPortalTrigger(state, portal, 1100);
    expect(second.portal).toBeNull();
    state = second.state;

    const third = stepPortalTrigger(state, portal, 5000);
    expect(third.portal).toBeNull();
  });

  it("re-arms only after the hero leaves every portal", () => {
    let state = stepPortalTrigger(
      { insidePortalId: null, armed: true, lockedUntil: 0 },
      portal,
      1000
    ).state;
    expect(state.armed).toBe(false);

    state = stepPortalTrigger(state, null, 1200).state;
    expect(state.armed).toBe(true);
    expect(state.insidePortalId).toBeNull();

    const again = stepPortalTrigger(state, portal, 3000);
    expect(again.portal).toBe(portal);
  });

  it("honours the cooldown window even if the hero steps out and back in", () => {
    let state = stepPortalTrigger(
      { insidePortalId: null, armed: true, lockedUntil: 0 },
      portal,
      1000
    ).state;
    state = stepPortalTrigger(state, null, 1100).state;

    const tooSoon = stepPortalTrigger(state, portal, 1500);
    expect(tooSoon.portal).toBeNull();

    // The blocked entry still leaves the hero standing inside the portal, so they
    // must step out once more before the zone can fire again.
    const left = stepPortalTrigger(tooSoon.state, null, 2000);
    expect(left.state.armed).toBe(true);

    const later = stepPortalTrigger(left.state, portal, 5000);
    expect(later.portal).toBe(portal);
  });
});

describe("portal geometry", () => {
  it("treats the rect edges as inside and just outside as outside", () => {
    const rect = { x: 10, y: 20, w: 100, h: 50 };
    expect(isInsideRect(rect, 10, 20)).toBe(true);
    expect(isInsideRect(rect, 110, 70)).toBe(true);
    expect(isInsideRect(rect, 9, 20)).toBe(false);
    expect(isInsideRect(rect, 111, 20)).toBe(false);
    expect(isInsideRect(undefined, 10, 20)).toBe(false);
  });

  it("finds the portal under a ground position", () => {
    const map = MAPS["dong-mon-thanh"];
    expect(portalAt(map, 300, 7000)?.id).toBe("west-gate");
    expect(portalAt(map, 3000, 7000)).toBeNull();
  });
});
