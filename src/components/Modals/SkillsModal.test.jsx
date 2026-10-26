import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
import { skillById } from "../../game/skills.js";
import { SkillsModal } from "./SkillsModal.jsx";

const mockSkills = [
  {
    id: "test_skill_1",
    sect: "thieu-lam",
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
    sect: "thieu-lam",
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
        <SkillsModal isOpen={true} skills={mockSkills} level={1} />
      </I18nProvider>
    );

    expect(markup).toContain("skill-node unlocked");
    expect(markup).toContain("skill-node locked");
    expect(markup).toContain("Cần cấp 5");
  });

  it("shows the default selected skill details and bind buttons", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal
          isOpen={true}
          skills={mockSkills}
          level={5}
          skillLoadout={{ u: 0, i: 1, o: 2, p: 3, left: 0, right: 1 }}
        />
      </I18nProvider>
    );

    expect(markup).toContain('<span class="skills-detail-name">Đại Tu Di Chưởng</span>');
    expect(markup).toContain("12 MP");
    expect(markup).toContain("Cự ly: 200");
    expect(markup).toContain("ST: 120%");
    expect(markup).toContain("key-btn active");
    expect(markup).toContain("mouse-btn active");
    expect(markup).toContain('<span class="skill-node-keys">UL</span>');
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

    expect(markup).toContain("Cần Thiếu Lâm Tâm Pháp cấp 5");
    // The tile badge must show the blocking level (5), not the skill's own unlockLevel (1).
    expect(markup).toContain(
      '<span class="skill-node-level" aria-hidden="true">5</span>'
    );
  });

  it("displays correct sect badge for different sects", () => {
    for (const [sect, expectedLabel] of [
      ["thieu-lam", "Thiếu Lâm"],
      ["vo-dang", "Võ Đang"],
      ["nga-my", "Nga My"],
      ["ngu-doc", "Ngũ Độc"]
    ]) {
      const markup = renderToStaticMarkup(
        <I18nProvider>
          <SkillsModal isOpen={true} skills={[]} sect={sect} />
        </I18nProvider>
      );
      expect(markup).toContain(`<span class="skills-sect-badge">${expectedLabel}</span>`);
    }
  });
});
