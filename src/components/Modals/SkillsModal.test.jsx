import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
import { skillById } from "../../game/skills.js";
import { SkillsModal } from "./SkillsModal.jsx";

const mockSkills = [
  {
    id: "test_skill_1",
    weapon: "bao-tay",
    slot: 0,
    glyph: "掌",
    nameKey: "skills.thieuLam.daiTuDiChuong.name",
    descKey: "skills.thieuLam.daiTuDiChuong.desc",
    unlockLevel: 1,
    mp: 12,
    cooldown: 6000,
    target: "enemy",
    range: 200,
    mult: 1.2
  },
  {
    id: "test_skill_2",
    weapon: "bao-tay",
    slot: 1,
    glyph: "陣",
    nameKey: "skills.thieuLam.laHanTran.name",
    descKey: "skills.thieuLam.laHanTran.desc",
    unlockLevel: 5,
    mp: 18,
    cooldown: 9000,
    target: "self",
    range: 0,
    mult: 0,
    requires: [{ id: "test_skill_1", level: 1 }]
  }
];

describe("SkillsModal Component", () => {
  it("does not render when isOpen is false", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal isOpen={false} skills={mockSkills} />
      </I18nProvider>
    );
    expect(markup).toBe("");
  });

  it("renders the skills as a tree with arrowed connectors", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal isOpen={true} skills={mockSkills} level={1} />
      </I18nProvider>
    );

    // Modal title
    expect(markup).toContain('<span class="skills-title">Võ Công</span>');

    // Tree tiles and the connector between them
    expect(markup).toContain('class="skills-tree"');
    expect(markup).toContain('data-skill-id="test_skill_1"');
    expect(markup).toContain('data-skill-id="test_skill_2"');
    expect(markup).toContain('class="skill-tree-link"');
    expect(markup).toContain('marker-end="url(#skill-tree-arrow)"');

    // Legacy card list is gone
    expect(markup).not.toContain("skill-card-row");
  });

  it("distinguishes unlocked and locked tiles", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal isOpen={true} skills={mockSkills} level={5} learnedSkills={["test_skill_1"]} />
      </I18nProvider>
    );

    expect(markup).toContain("skill-node unlocked");
    expect(markup).toContain("skill-node locked");
    expect(markup).toContain("Cần học test_skill_1 trước");
  });

  it("shows the default selected skill details and the drag hint", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal
          isOpen={true}
          skills={mockSkills}
          level={5}
          learnedSkills={["test_skill_1", "test_skill_2"]}
          quickSlotsMapping={{ 1: "skill:test_skill_1", 4: "skill:test_skill_1" }}
        />
      </I18nProvider>
    );

    expect(markup).toContain('<span class="skills-detail-name">Đại Tu Di Chưởng</span>');
    expect(markup).toContain("12 MP");
    expect(markup).toContain("Cự ly: 200");
    expect(markup).toContain("ST: 120%");
    expect(markup).toContain('class="skills-drag-hint"');
    expect(markup).toContain('<span class="skill-node-keys">1 4</span>');
  });

  it("reports the prerequisite that still blocks a skill", () => {
    const gated = [
      skillById("thieu_lam_tam_phap"),
      {
        ...skillById("dai_tu_di_chuong"),
        requires: [{ id: "thieu_lam_tam_phap", level: 5 }]
      }
    ];

    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal isOpen={true} skills={gated} level={1} />
      </I18nProvider>
    );

    expect(markup).toContain("Cần học Thiếu Lâm Tâm Pháp trước");
    // The tile badge shows the blocking level of the prerequisite.
    expect(markup).toContain(
      '<span class="skill-node-level" aria-hidden="true">1</span>'
    );
  });

  it("displays the correct weapon badge for different kits", () => {
    for (const [weapon, expectedLabel] of [
      ["kiem", "Kiếm"],
      ["bao-tay", "Bao Tay"],
      ["dao", "Đao"]
    ]) {
      const markup = renderToStaticMarkup(
        <I18nProvider>
          <SkillsModal isOpen={true} skills={[]} weapon={weapon} />
        </I18nProvider>
      );
      expect(markup).toContain(`<span class="skills-weapon-badge">${expectedLabel}</span>`);
    }
  });

  it("shows the skill level, its scaled damage and an affordable upgrade", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal
          isOpen={true}
          skills={mockSkills}
          level={5}
          learnedSkills={["test_skill_1"]}
          skillLevels={{ test_skill_1: 5 }}
          coins={10000}
          exp={10000}
        />
      </I18nProvider>
    );

    expect(markup).toContain("Cấp 5/10");
    expect(markup).toContain("+40% hiệu quả");
    // 1.2 multiplier at level 5 (1 + 0.1 * 4) = 1.68
    expect(markup).toContain("ST: 168%");
    expect(markup).toContain('class="skills-upgrade-btn"');
    expect(markup).not.toContain('class="skills-upgrade-btn" disabled');
    expect(markup).toContain("Nâng cấp — Cấp 6");
    expect(markup).toContain("40 bạc");
  });

  it("disables an unaffordable upgrade and marks a maxed skill", () => {
    const broke = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal
          isOpen={true}
          skills={mockSkills}
          level={5}
          learnedSkills={["test_skill_1"]}
          coins={0}
          exp={0}
        />
      </I18nProvider>
    );
    expect(broke).toContain('class="skills-upgrade-btn" disabled');

    const maxed = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal
          isOpen={true}
          skills={mockSkills}
          level={5}
          learnedSkills={["test_skill_1"]}
          skillLevels={{ test_skill_1: 10 }}
          coins={10000}
          exp={10000}
        />
      </I18nProvider>
    );
    expect(maxed).toContain("Đã đạt cấp tối đa (10)");
    expect(maxed).not.toContain('class="skills-upgrade-btn"');
  });
});
