import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../i18n/I18nProvider.jsx";
import { MobileSkillPicker } from "./MobileSkillPicker.jsx";

const skills = [
  {
    id: "test_skill_1",
    slot: 0,
    glyph: "掌",
    nameKey: "skills.thieuLam.daiTuDiChuong.name",
    unlockLevel: 1,
    mp: 12,
    target: "enemy"
  },
  {
    id: "test_skill_2",
    slot: 1,
    glyph: "陣",
    nameKey: "skills.thieuLam.laHanTran.name",
    unlockLevel: 5,
    mp: 18,
    target: "self"
  }
];

const renderPicker = (props = {}) =>
  renderToStaticMarkup(
    <I18nProvider>
      <MobileSkillPicker isOpen={true} skills={skills} level={1} {...props} />
    </I18nProvider>
  );

describe("MobileSkillPicker", () => {
  it("renders nothing when closed", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MobileSkillPicker isOpen={false} skills={skills} />
      </I18nProvider>
    );
    expect(markup).toBe("");
  });

  it("lists the weapon skills for the tapped button", () => {
    const markup = renderPicker({ slotIndex: 1, learnedSkills: ["test_skill_1"] });

    expect(markup).toContain("Chọn chiêu cho nút 2");
    expect(markup).toContain("Đại Tu Di Chưởng");
    expect(markup).toContain("12 MP");
    // The level-5 art stays visible but disabled with its lock hint.
    expect(markup).toContain("Cần cấp 5");
    expect(markup).toContain("mobile-picker-row locked");
  });

  it("shows the clear action only for a bound button", () => {
    expect(renderPicker()).not.toContain("mobile-picker-clear");
    expect(renderPicker({ selectedSkillId: "test_skill_1" })).toContain("mobile-picker-clear");
  });
});
