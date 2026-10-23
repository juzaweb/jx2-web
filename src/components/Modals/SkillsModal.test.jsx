import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
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
    mp: 10,
    cooldown: 2000,
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
    mp: 20,
    cooldown: 5000,
    target: "self",
    range: 0,
    mult: 0
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

  it("renders skills list and distinguishes unlocked vs locked skills", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SkillsModal isOpen={true} skills={mockSkills} level={1} />
      </I18nProvider>
    );

    // Modal title
    expect(markup).toContain('<span class="skills-title">Võ Công</span>');

    // Unlocked skill card
    expect(markup).toContain("skill-card-row unlocked");
    expect(markup).toContain("Đại Tu Di Chưởng");
    expect(markup).toContain("Cự ly: 200");
    expect(markup).toContain("ST: 120%");

    // Locked skill card
    expect(markup).toContain("skill-card-row locked");
    expect(markup).toContain("Cần cấp 5");
  });

  it("renders shortcut binding buttons and respects self-target constraints", () => {
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

    expect(markup).toContain("key-btn active");
    expect(markup).toContain("mouse-btn active");
    expect(markup).toContain('<span class="skill-bound-badge">U, L</span>');
    expect(markup).toContain('<span class="skill-bound-badge">I, R</span>');
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
