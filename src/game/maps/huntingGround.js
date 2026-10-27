/**
 * Shared builder for a faction hunting ground.
 *
 * The three hunting grounds of a capital differ only in name, entrance side,
 * monster groups and palette. Everything else — bounds, camp scatter, tier
 * zones, perimeter trees, the return gate — is the same shape, so it lives here
 * once instead of six near-identical map files.
 *
 * Pure data, no Phaser imports.
 */

import { expandCamps } from "./camps.js";

/** Inclusive rectangle helper for the tier zones. */
const zone = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

/** World size of every hunting ground. */
const BOUNDS = { x0: 0, y0: 0, x1: 16000, y1: 14000 };

/**
 * Entrance geometry per side. The trail always runs from the map edge toward
 * the middle; the return portal sits on that edge and the hero spawns clear of
 * it so arriving never bounces back.
 */
const SIDES = {
  south: {
    spawn: { x: 7600, y: 12800 },
    portal: { x: 7600, y: 13400, w: 800, h: 500 },
    gate: { x: 7400, y: 13400, w: 1200, h: 130, orientation: "horizontal" },
    trail: { x: 7400, y: 9000, w: 1200, d: 4400 }
  },
  west: {
    spawn: { x: 1400, y: 7000 },
    portal: { x: 120, y: 6650, w: 420, h: 700 },
    gate: { x: 120, y: 6650, w: 130, h: 700, orientation: "vertical" },
    trail: { x: 260, y: 6800, w: 9800, d: 420 }
  },
  east: {
    spawn: { x: 14600, y: 7000 },
    portal: { x: 15460, y: 6650, w: 420, h: 700 },
    gate: { x: 15460, y: 6650, w: 130, h: 700, orientation: "vertical" },
    trail: { x: 5900, y: 6800, w: 9800, d: 420 }
  }
};

/**
 * Decorative border trees, deterministic so the map is identical every boot.
 * Anything too close to the entrance or its return portal is dropped: the
 * vegetation sprites carry collision bodies, and a tree on the spawn point
 * would trap the hero.
 * @param {{x:number,y:number}} spawn
 * @param {{x:number,y:number,w:number,h:number}} portal
 * @returns {Array<Array<number|string>>}
 */
function borderTrees(spawn, portal) {
  const portalCx = portal.x + portal.w / 2;
  const portalCy = portal.y + portal.h / 2;
  const trees = [];

  const add = (x, y, scale, kind) => {
    if (Math.hypot(x - spawn.x, y - spawn.y) < 900) return;
    if (Math.hypot(x - portalCx, y - portalCy) < 800) return;
    trees.push([x, y, scale, kind]);
  };

  for (let i = 0; i < 10; i++) {
    const x = 700 + i * 1620;
    const topScale = 0.92 + ((i * 7) % 15) / 100;
    const bottomScale = 0.9 + ((i * 11) % 18) / 100;
    add(x, 620 + ((i * 37) % 260), topScale, i % 2 ? "tree-large" : "bush-large");
    add(x, 12900 + ((i * 53) % 360), bottomScale, i % 2 ? "tree-medium" : "bush-small");
  }

  for (let j = 1; j < 8; j++) {
    const y = 1400 + j * 1550;
    const leftScale = 0.9 + ((j * 9) % 16) / 100;
    const rightScale = 0.92 + ((j * 5) % 14) / 100;
    add(650, y, leftScale, j % 2 ? "tree-medium" : "bush-medium");
    add(15300, y, rightScale, j % 2 ? "bush-large" : "tree-large");
  }

  return trees;
}

/** Sparse grass tufts, also kept off the entrance. */
function borderGrass(spawn) {
  const tufts = [];
  for (let i = 0; i < 24; i++) {
    const x = 1200 + ((i * 811) % 13600);
    const y = 1200 + ((i * 1447) % 11600);
    if (Math.hypot(x - spawn.x, y - spawn.y) < 500) continue;
    tufts.push([x, y, 0.88 + ((i * 3) % 14) / 100]);
  }
  return tufts;
}

/**
 * Build one hunting ground.
 *
 * @param {object} spec
 * @param {string} spec.id
 * @param {string} spec.name
 * @param {"south"|"west"|"east"} spec.side entrance side facing the capital
 * @param {string} spec.cityMapId capital this ground hangs off
 * @param {string} spec.cityName label of the return gate
 * @param {{x:number,y:number}} spec.citySpawn landing point inside the capital
 * @param {Array<object>} spec.groups three `{monsterId, y, minLevel, maxLevel, band:[y0,y1]}`
 * @param {object} spec.palette ground colours
 * @returns {import("./mapRegistry.js").MapDefinition}
 */
export function defineHuntingGround({
  id,
  name,
  side,
  cityMapId,
  cityName,
  citySpawn,
  groups,
  palette
}) {
  const entrance = SIDES[side];
  if (!entrance) throw new Error(`Unknown hunting-ground side: ${side}`);
  if (!citySpawn) throw new Error(`Hunting ground ${id} needs a citySpawn`);
  if (!Array.isArray(groups) || groups.length !== 3) {
    throw new Error(`Hunting ground ${id} must define exactly three tiers`);
  }

  const camps = [];
  for (const group of groups) {
    camps.push({ monsterId: group.monsterId, x: 4000, y: group.y, count: 15 });
    camps.push({ monsterId: group.monsterId, x: 11000, y: group.y, count: 15 });
  }

  const zones = groups.map((group, index) => ({
    id: `tier-${index + 1}`,
    minLevel: group.minLevel,
    maxLevel: group.maxLevel,
    bounds: zone(0, group.band[0], BOUNDS.x1, group.band[1])
  }));

  return {
    id,
    name,
    safe: false,
    /** Hunting ground: PvP stays opt-in through the PK flag. */
    pvpMode: "flag",

    bounds: { ...BOUNDS },
    spawn: { ...entrance.spawn },

    ground: {
      rim: palette.rim,
      fill: palette.fill,
      tileKey: "ground-forest",
      tileAlpha: 1,
      pad: 380,
      regions: [
        { x: 260, y: 260, w: 15480, h: 13480, fill: palette.region, alpha: 0.32 },
        { x: 260, y: 260, w: 15480, h: 4200, fill: palette.shade, alpha: 0.4 },
        { x: 260, y: 8580, w: 15480, h: 5160, fill: palette.region, alpha: 0.2 }
      ],
      streets: [
        {
          ...entrance.trail,
          fill: palette.trail,
          alpha: 0.6
        }
      ]
    },

    buildings: [],
    trees: borderTrees(entrance.spawn, entrance.portal),
    grass: borderGrass(entrance.spawn),

    gates: [
      {
        id: `${id}-gate`,
        ...entrance.gate,
        label: cityName
      }
    ],

    portals: [
      {
        id: "city-gate",
        label: cityName,
        rect: { ...entrance.portal },
        targetMapId: cityMapId,
        targetSpawn: { ...citySpawn }
      }
    ],

    npcs: [],
    zones,
    enemySpawns: expandCamps(camps)
  };
}
