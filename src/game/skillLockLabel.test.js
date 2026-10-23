import { describe, it, expect } from "vitest";
import { skillById } from "./skills.js";
import { formatSkillLock, skillLockLabel } from "./skillLockLabel.js";

/** Minimal translator stub so the assertions do not depend on the active locale. */
const t = (key, params, fallback) => {
  if (key === "skills.tree.requires") return `prereq:${params.name}@${params.level}`;
  if (key === "skills.picker.locked") return `level:${params.level}`;
  if (key === "skills.thieuLam.laHanQuyen.name") return "La Hán Quyền";
  return fallback ?? key;
};

describe("skillLockLabel", () => {
  it("returns an empty string when the skill is available", () => {
    expect(skillLockLabel(skillById("la_han_quyen"), 1, t)).toBe("");
  });

  it("formats a pre-computed reason", () => {
    expect(formatSkillLock(null, t)).toBe("");
    expect(formatSkillLock({ kind: "level", level: 4 }, t)).toBe("level:4");
    expect(
      formatSkillLock({ kind: "prereq", nameKey: "skills.thieuLam.laHanQuyen.name", level: 5 }, t)
    ).toBe("prereq:La Hán Quyền@5");
  });

  it("labels a level gate", () => {
    expect(skillLockLabel(skillById("tam_thanh_kiem_phap"), 1, t)).toBe("level:2");
  });

  it("labels a prerequisite gate with the prerequisite name", () => {
    const gated = {
      ...skillById("dai_tu_di_chuong"),
      unlockLevel: 1,
      requires: [{ id: "la_han_quyen", level: 5 }]
    };
    expect(skillLockLabel(gated, 1, t)).toBe("prereq:La Hán Quyền@5");
  });
});
