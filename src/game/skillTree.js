/**
 * Layout maths for the "Bảng Võ Công" skill tree.
 *
 * The catalog is the single source of truth: every skill may declare
 * `requires: [{ id, level }]`, and this module turns that graph into absolute
 * tile positions plus SVG connector paths. No DOM access, so it is cheap to
 * test and safe to run during server-side rendering.
 */

import { skillUnlocked } from "./skills.js";

/** Side length (px) of one skill tile. */
export const TREE_TILE = 64;
/** Horizontal gap (px) between lanes. */
export const TREE_GAP_X = 34;
/** Vertical gap (px) between rows; must fit the connector arrow. */
export const TREE_GAP_Y = 46;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const pickSize = (value, fallback) => (isFiniteNumber(value) && value > 0 ? value : fallback);

/**
 * Build the tile/connector layout for one kit's skill list.
 *
 * Rows follow prerequisite depth, lanes spread branches horizontally. The first
 * child of a skill keeps its parent's lane so a straight kit renders as a
 * single column; extra children open lanes to the right. A skill may override
 * its lane with `treeLane` for hand-tuned art.
 *
 * @param {Object[]} skills Catalog entries of a single sect.
 * @param {{ tile?: number, gapX?: number, gapY?: number }} [options]
 * @returns {{
 *   nodes: { skill: Object, row: number, lane: number, x: number, y: number, depth: number }[],
 *   edges: { from: string, to: string, path: string }[],
 *   width: number,
 *   height: number,
 *   tile: number,
 *   gapX: number,
 *   gapY: number
 * }}
 */
export function buildSkillTree(skills = [], options = {}) {
  const tile = pickSize(options.tile, TREE_TILE);
  const gapX = pickSize(options.gapX, TREE_GAP_X);
  const gapY = pickSize(options.gapY, TREE_GAP_Y);

  const entries = (Array.isArray(skills) ? skills : [])
    .filter((skill) => skill && typeof skill.id === "string")
    .slice()
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || a.id.localeCompare(b.id));

  if (entries.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0, tile, gapX, gapY };
  }

  const byId = new Map(entries.map((skill) => [skill.id, skill]));

  /** Prerequisite ids that also live in this sect, in catalog order. */
  const parentsOf = new Map();
  for (const entry of entries) {
    const requires = Array.isArray(entry.requires) ? entry.requires : [];
    const parents = [];
    for (const req of requires) {
      const parent = byId.get(req?.id);
      if (parent && !parents.includes(parent.id)) parents.push(parent.id);
    }
    parentsOf.set(entry.id, parents);
  }

  const depthCache = new Map();
  const depthOf = (id, seen = new Set()) => {
    if (depthCache.has(id)) return depthCache.get(id);
    if (seen.has(id)) return 0;
    const parents = parentsOf.get(id) || [];
    if (parents.length === 0) {
      depthCache.set(id, 0);
      return 0;
    }
    const nextSeen = new Set(seen).add(id);
    const depth = 1 + Math.max(...parents.map((parent) => depthOf(parent, nextSeen)));
    depthCache.set(id, depth);
    return depth;
  };

  const usedLanesByRow = new Map();
  const laneOf = new Map();
  const childCount = new Map();

  /** First free lane at or right of `preferred`, reserved for that row. */
  const reserveLane = (row, preferred) => {
    const used = usedLanesByRow.get(row) || new Set();
    let lane = Math.max(0, preferred);
    while (used.has(lane)) lane += 1;
    used.add(lane);
    usedLanesByRow.set(row, used);
    return lane;
  };

  const depthById = new Map(entries.map((entry) => [entry.id, depthOf(entry.id)]));

  const ordered = entries.slice().sort(
    (a, b) =>
      depthById.get(a.id) - depthById.get(b.id) ||
      (a.slot ?? 0) - (b.slot ?? 0) ||
      a.id.localeCompare(b.id)
  );

  for (const skill of ordered) {
    const depth = depthById.get(skill.id);
    const parents = parentsOf.get(skill.id) || [];

    let preferred = Number.isInteger(skill.treeLane) && skill.treeLane >= 0 ? skill.treeLane : 0;
    if (parents.length > 0) {
      const primary = parents[0];
      const placed = childCount.get(primary) || 0;
      preferred = (laneOf.get(primary) ?? 0) + placed;
      childCount.set(primary, placed + 1);
    }

    laneOf.set(skill.id, reserveLane(depth, preferred));
  }

  const nodes = ordered.map((skill) => {
    const row = depthById.get(skill.id);
    const lane = laneOf.get(skill.id) ?? 0;
    return {
      skill,
      row,
      lane,
      depth: row,
      x: lane * (tile + gapX),
      y: row * (tile + gapY)
    };
  });

  const nodeById = new Map(nodes.map((node) => [node.skill.id, node]));
  const centerX = (node) => node.x + tile / 2;

  const edges = [];
  for (const node of nodes) {
    const parents = parentsOf.get(node.skill.id) || [];
    for (const parentId of parents) {
      const from = nodeById.get(parentId);
      if (!from) continue;

      const startX = centerX(from);
      const startY = from.y + tile;
      const endX = centerX(node);
      const endY = node.y;
      const path =
        from.lane === node.lane
          ? `M ${startX} ${startY} L ${endX} ${endY}`
          : `M ${startX} ${startY} V ${startY + gapY / 2} H ${endX} V ${endY}`;

      edges.push({ from: from.skill.id, to: node.skill.id, path });
    }
  }

  const maxLane = nodes.reduce((max, node) => Math.max(max, node.lane), 0);
  const maxRow = nodes.reduce((max, node) => Math.max(max, node.row), 0);

  return {
    nodes,
    edges,
    width: (maxLane + 1) * tile + maxLane * gapX,
    height: (maxRow + 1) * tile + maxRow * gapY,
    tile,
    gapX,
    gapY
  };
}

/**
 * Skill id that should be selected when the panel opens: the first available
 * skill in slot order, otherwise the first skill of the tree.
 *
 * @param {Object[]} skills
 * @param {number} level
 * @returns {string|null}
 */
export function initialSelectedId(skills = [], level = 1) {
  const entries = (Array.isArray(skills) ? skills : [])
    .filter((skill) => skill && typeof skill.id === "string")
    .slice()
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || a.id.localeCompare(b.id));

  if (entries.length === 0) return null;
  const unlocked = entries.find((skill) => skillUnlocked(skill, level));
  return (unlocked || entries[0]).id;
}
