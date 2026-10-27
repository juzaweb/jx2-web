import { describe, it, expect } from "vitest";
import { skillById } from "./skills.js";
import { formatSkillLock, skillLockLabel } from "./skillLockLabel.js";

/** Minimal translator stub so the assertions do not depend on the active locale. */
const t = (key, params, fallback) => {
  if (key === "skills.tree.requires") return `prereq:${params.name}@${params.level}`;
  if (key === "skills.picker.locked") return `level:${params.level}`;
  if (key === "skills.thieuLam.thieuLamTamPhap.name") return "Thiếu Lâm Tâm Pháp";
  return fallback ?? key;
};

describe("skillLockLabel", () => {
  it("returns an empty string when the skill is available", () => {
    expect(skillLockLabel(skillById("thieu_lam_tam_phap"), 1, null, t)).toBe("");
  });

  it("formats a pre-computed reason", () => {
    expect(formatSkillLock(null, t)).toBe("");
    expect(formatSkillLock({ kind: "level", level: 4 }, t)).toBe("level:4");
    expect(formatSkillLock({ kind: "book" }, t)).toBe("skills.picker.needsBook");
    expect(
      formatSkillLock({ kind: "prereq", nameKey: "skills.thieuLam.thieuLamTamPhap.name", level: 5 }, t)
    ).toBe("prereq:Thiếu Lâm Tâm Pháp@5");
  });

  it("labels a level gate", () => {
    expect(skillLockLabel(skillById("tam_thanh_kiem_phap"), 1, null, t)).toBe("level:2");
  });

  it("labels a prerequisite gate with the prerequisite name", () => {
    const gated = {
      ...skillById("dai_tu_di_chuong"),
      unlockLevel: 1,
      requires: [{ id: "thieu_lam_tam_phap", level: 5 }]
    };
    expect(skillLockLabel(gated, 1, null, t)).toBe("prereq:Thiếu Lâm Tâm Pháp@5");
  });

  it("labels an unlearned skill as needing a book", () => {
    expect(skillLockLabel(skillById("la_han_quyen"), 1, [], t)).toBe("skills.picker.needsBook");
  });
});
