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
  isCombatAllowed,
  mapPvpMode,
  mapSize,
  mapWorldConfig
} from "./mapRegistry.js";
import { gateAt, isInsideRect, portalAt, stepPortalTrigger } from "./portals.js";

/** Ground rectangle of a map, as a portal-style rect. */
const boundsRect = (map) => ({
  x: map.bounds.x0,
  y: map.bounds.y0,
  w: map.bounds.x1 - map.bounds.x0,
  h: map.bounds.y1 - map.bounds.y0
});

describe("map registry", () => {
  it("registers every city, hunting ground and the battlefield", () => {
    expect(MAP_IDS).toEqual([
      "market",
      "dong-mon-thanh",
      "bac-linh",
      "tay-son",
      "trung-nguyen",
      "thuc-thanh",
      "nguy-thanh",
      "ba-thuc",
      "kiem-cac",
      "nga-mi",
      "hua-dien",
      "nghiep-quan",
      "quan-trung"
    ]);
    expect(isKnownMap("trung-nguyen")).toBe(true);
    expect(isKnownMap("thuc-thanh")).toBe(true);
    expect(isKnownMap("nguy-thanh")).toBe(true);
    expect(isKnownMap("ba-thuc")).toBe(true);
    expect(isKnownMap("kiem-cac")).toBe(true);
    expect(isKnownMap("nga-mi")).toBe(true);
    expect(isKnownMap("hua-dien")).toBe(true);
    expect(isKnownMap("nghiep-quan")).toBe(true);
    expect(isKnownMap("quan-trung")).toBe(true);
    expect(isKnownMap("nowhere")).toBe(false);
    expect(getMap("nowhere").id).toBe(DEFAULT_MAP_ID);
  });

  it("gives every city four open gates and opens its south gate onto the battlefield", () => {
    for (const id of ["market", "thuc-thanh", "nguy-thanh"]) {
      const map = MAPS[id];
      expect(map.gates, `${id} must have four gates`).toHaveLength(4);
      expect(map.portals, `${id} must have four working gates`).toHaveLength(4);
      const south = findPortal(id, "south-gate");
      expect(south, `${id} must wire its south gate`).toBeTruthy();
      expect(south.targetMapId).toBe("trung-nguyen");
    }
  });

  it("gives every city a complete network of streets connecting its four gates", () => {
    for (const id of ["market", "thuc-thanh", "nguy-thanh"]) {
      const map = MAPS[id];
      const streets = map.ground?.streets || [];
      expect(streets.length, `${id} must have streets defined`).toBeGreaterThanOrEqual(2);

      // Verify that every gate has a street covering or adjoining its entrance
      for (const gate of map.gates) {
        const connects = streets.some((st) => {
          const stX1 = st.x + (st.w || 0);
          const stY1 = st.y + (st.d || 0);
          const gateX1 = gate.x + gate.w;
          const gateY1 = gate.y + gate.h;

          // Check overlap or touch along the gate axis
          const xOverlap = Math.max(0, Math.min(stX1, gateX1) - Math.max(st.x, gate.x));
          const yOverlap = Math.max(0, Math.min(stY1, gateY1) - Math.max(st.y, gate.y));

          if (gate.orientation === "vertical") {
            // East or west gate: street depth overlaps gate height, and street reaches within tolerance
            return yOverlap >= 400 && (Math.abs(st.x - gate.x) <= 300 || Math.abs(stX1 - gateX1) <= 300);
          }
          // North or south gate: street width overlaps gate width, and street reaches within tolerance
          return xOverlap >= 400 && (Math.abs(st.y - gate.y) <= 300 || Math.abs(stY1 - gateY1) <= 300);
        });

        expect(connects, `${id} street network must connect to gate ${gate.id} (${gate.label})`).toBe(true);
      }

      // Check mapWorldConfig provides streets
      const config = mapWorldConfig(id);
      expect(config.streets).toEqual(streets);
    }
  });

  it("gives each capital one hunting ground behind every non-south gate", () => {
    const expected = {
      market: { "east-gate": "dong-mon-thanh", "north-gate": "bac-linh", "west-gate": "tay-son" },
      "thuc-thanh": { "east-gate": "ba-thuc", "north-gate": "kiem-cac", "west-gate": "nga-mi" },
      "nguy-thanh": { "east-gate": "hua-dien", "north-gate": "nghiep-quan", "west-gate": "quan-trung" }
    };

    for (const [cityId, gates] of Object.entries(expected)) {
      for (const [portalId, targetId] of Object.entries(gates)) {
        expect(findPortal(cityId, portalId)?.targetMapId, `${cityId}/${portalId}`).toBe(targetId);
        expect(MAPS[targetId].pvpMode).toBe("flag");
      }
    }
  });

  it("gives every phase-2 hunting ground three tiers of ninety spawns", () => {
    const grounds = ["ba-thuc", "kiem-cac", "nga-mi", "hua-dien", "nghiep-quan", "quan-trung"];
    for (const id of grounds) {
      expect(MAPS[id].enemySpawns, `${id} spawn count`).toHaveLength(90);
      expect(MAPS[id].zones, `${id} tier count`).toHaveLength(3);
    }
  });

  it("wires every portal back to the map it came from", () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      for (const portal of map.portals || []) {
        const reverse = (MAPS[portal.targetMapId]?.portals || []).some(
          (other) => other.targetMapId === id
        );
        expect(reverse, `${id} -> ${portal.targetMapId} needs a return portal`).toBe(true);
      }
    }
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

  it("only the three capitals are no-combat safe zones", () => {
    expect(isCombatAllowed("market")).toBe(false);
    expect(isCombatAllowed(MAPS.market)).toBe(false);
    expect(isCombatAllowed("thuc-thanh")).toBe(false);
    expect(isCombatAllowed("nguy-thanh")).toBe(false);
    expect(isCombatAllowed("dong-mon-thanh")).toBe(true);
    expect(isCombatAllowed("trung-nguyen")).toBe(true);
    // Callers that have not loaded a map yet (boot, unit tests) keep fighting.
    expect(isCombatAllowed(undefined)).toBe(true);
    expect(isCombatAllowed({ id: "custom", bounds: MAPS.market.bounds })).toBe(true);
  });

  it("only the battlefield uses faction PvP", () => {
    expect(mapPvpMode("market")).toBe("none");
    expect(mapPvpMode("thuc-thanh")).toBe("none");
    expect(mapPvpMode("nguy-thanh")).toBe("none");
    expect(mapPvpMode("dong-mon-thanh")).toBe("flag");
    expect(mapPvpMode("bac-linh")).toBe("flag");
    expect(mapPvpMode("tay-son")).toBe("flag");
    expect(mapPvpMode("trung-nguyen")).toBe("faction");
    // A map authored before PvP modes existed keeps the legacy flag rule.
    expect(mapPvpMode({ id: "legacy", bounds: MAPS.market.bounds })).toBe("flag");
  });

  it("resolves portals by id for server-side travel validation", () => {
    expect(findPortal("market", "east-gate")?.targetMapId).toBe("dong-mon-thanh");
    expect(findPortal("market", "west-gate")?.targetMapId).toBe("tay-son");
    expect(findPortal("market", "north-gate")?.targetMapId).toBe("bac-linh");
    expect(findPortal("market", "south-gate")?.targetMapId).toBe("trung-nguyen");
    expect(findPortal("dong-mon-thanh", "west-gate")?.targetMapId).toBe("market");
    expect(findPortal("trung-nguyen", "ngo-gate")?.targetMapId).toBe("market");
    expect(findPortal("trung-nguyen", "thuc-gate")?.targetMapId).toBe("thuc-thanh");
    expect(findPortal("trung-nguyen", "nguy-gate")?.targetMapId).toBe("nguy-thanh");
    expect(findPortal("thuc-thanh", "south-gate")?.targetMapId).toBe("trung-nguyen");
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

  it("finds the portal and the gate under a ground position", () => {
    const map = MAPS["dong-mon-thanh"];
    expect(portalAt(map, 300, 7000)?.id).toBe("west-gate");
    expect(portalAt(map, 3000, 7000)).toBeNull();

    const city = MAPS.market;
    expect(gateAt(city, 6350, 2650)?.id).toBe("market-north-gate");
    expect(gateAt(city, 4000, 4000)).toBeNull();
  });
});
