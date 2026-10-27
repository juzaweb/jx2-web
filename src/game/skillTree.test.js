import { describe, it, expect } from "vitest";
import {
  buildSkillTree,
  initialSelectedId,
  TREE_GAP_X,
  TREE_GAP_Y,
  TREE_TILE
} from "./skillTree.js";

const makeSkill = (id, slot, requires = []) => ({
  id,
  slot,
  unlockLevel: 1,
  nameKey: `skills.test.${id}.name`,
  requires
});

describe("buildSkillTree", () => {
  it("returns an empty layout when the kit has no skills", () => {
    const tree = buildSkillTree([]);
    expect(tree.nodes).toEqual([]);
    expect(tree.edges).toEqual([]);
    expect(tree.width).toBe(0);
    expect(tree.height).toBe(0);
  });

  it("lays a linear prerequisite chain out as a single column", () => {
    const tree = buildSkillTree([
      makeSkill("a", 0),
      makeSkill("b", 1, [{ id: "a", level: 1 }]),
      makeSkill("c", 2, [{ id: "b", level: 1 }])
    ]);

    expect(tree.nodes.map((node) => node.skill.id)).toEqual(["a", "b", "c"]);
    expect(tree.nodes.map((node) => node.row)).toEqual([0, 1, 2]);
    expect(tree.nodes.every((node) => node.lane === 0)).toBe(true);
    expect(tree.nodes.map((node) => node.y)).toEqual([
      0,
      TREE_TILE + TREE_GAP_Y,
      2 * (TREE_TILE + TREE_GAP_Y)
    ]);
    expect(tree.edges.map((edge) => `${edge.from}->${edge.to}`)).toEqual(["a->b", "b->c"]);
    expect(tree.width).toBe(TREE_TILE);
    expect(tree.height).toBe(3 * TREE_TILE + 2 * TREE_GAP_Y);
  });

  it("opens a new lane for a second child and draws an elbow connector", () => {
    const tree = buildSkillTree([
      makeSkill("root", 0),
      makeSkill("left", 1, [{ id: "root", level: 1 }]),
      makeSkill("right", 2, [{ id: "root", level: 1 }]),
      makeSkill("leaf", 3, [{ id: "right", level: 1 }])
    ]);

    const byId = new Map(tree.nodes.map((node) => [node.skill.id, node]));
    expect(byId.get("root").lane).toBe(0);
    expect(byId.get("left").lane).toBe(0);
    expect(byId.get("right").lane).toBe(1);
    expect(byId.get("leaf").lane).toBe(1);
    expect(byId.get("leaf").row).toBe(2);

    const straight = tree.edges.find((edge) => edge.from === "root" && edge.to === "left");
    const elbow = tree.edges.find((edge) => edge.from === "root" && edge.to === "right");
    expect(straight.path).not.toContain("H");
    expect(elbow.path).toContain("V");
    expect(elbow.path).toContain("H");

    expect(tree.width).toBe(2 * TREE_TILE + TREE_GAP_X);
  });

  it("ignores prerequisites outside the kit", () => {
    const tree = buildSkillTree([makeSkill("a", 0, [{ id: "missing", level: 1 }])]);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].row).toBe(0);
    expect(tree.edges).toEqual([]);
  });

  it("spreads independent roots across lanes instead of overlapping them", () => {
    const tree = buildSkillTree([makeSkill("first", 0), makeSkill("second", 1)]);

    expect(tree.nodes.map((node) => node.row)).toEqual([0, 0]);
    expect(tree.nodes.map((node) => node.lane)).toEqual([0, 1]);
    expect(tree.width).toBe(2 * TREE_TILE + TREE_GAP_X);
  });

  it("terminates on a cyclic catalog instead of hanging", () => {
    const tree = buildSkillTree([
      makeSkill("a", 0, [{ id: "b", level: 1 }]),
      makeSkill("b", 1, [{ id: "a", level: 1 }])
    ]);

    expect(tree.nodes).toHaveLength(2);
    for (const node of tree.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it("honours an explicit treeLane override", () => {
    const shifted = makeSkill("a", 0);
    shifted.treeLane = 2;
    const tree = buildSkillTree([shifted]);
    expect(tree.nodes[0].lane).toBe(2);
    expect(tree.width).toBe(3 * TREE_TILE + 2 * TREE_GAP_X);
  });
});

describe("initialSelectedId", () => {
  const skills = [
    makeSkill("late", 2),
    { ...makeSkill("early", 0), unlockLevel: 3 }
  ];

  it("prefers the first unlocked skill in slot order", () => {
    expect(initialSelectedId(skills, 1)).toBe("late");
    expect(initialSelectedId(skills, 3)).toBe("early");
  });

  it("prefers the first learned skill when a learned set is given", () => {
    // Both are level-unlocked at 5, but only the later slot was studied.
    expect(initialSelectedId(skills, 5, ["late"])).toBe("late");
    expect(initialSelectedId(skills, 5, ["early"])).toBe("early");
    // Nothing learned: the starter tile keeps the fallback behaviour.
    expect(initialSelectedId(skills, 5, [])).toBe("early");
  });

  it("falls back to the first skill and returns null for an empty kit", () => {
    expect(initialSelectedId([{ ...makeSkill("locked", 0), unlockLevel: 9 }], 1)).toBe("locked");
    expect(initialSelectedId([], 1)).toBeNull();
  });
});
