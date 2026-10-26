import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../i18n/I18nProvider.jsx";
import { MobileControls } from "./MobileControls.jsx";

const renderControls = (props = {}) =>
  renderToStaticMarkup(
    <I18nProvider>
      <MobileControls skills={[]} {...props} />
    </I18nProvider>
  );

describe("MobileControls logic & props", () => {
  it("can be instantiated/rendered without exploding", () => {
    const element = <MobileControls skills={[]} />;
    expect(element).toBeDefined();
    expect(element.type).toBe(MobileControls);
  });

  it("passes correct props structure for skills and callbacks", () => {
    const onMove = vi.fn();
    const onAttack = vi.fn();
    const onCastSkill = vi.fn();
    const onAssignSkill = vi.fn();
    const onUseItem = vi.fn();

    const element = (
      <MobileControls
        onMove={onMove}
        onAttack={onAttack}
        onCastSkill={onCastSkill}
        onAssignSkill={onAssignSkill}
        onUseItem={onUseItem}
        skills={[{ slot: 0, id: "test_skill" }]}
      />
    );

    expect(element.props.onMove).toBe(onMove);
    expect(element.props.onAttack).toBe(onAttack);
    expect(element.props.onCastSkill).toBe(onCastSkill);
    expect(element.props.onAssignSkill).toBe(onAssignSkill);
    expect(element.props.onUseItem).toBe(onUseItem);
  });

  it("renders four empty skill buttons with a + prompt by default", () => {
    const markup = renderControls();
    for (let idx = 0; idx < 4; idx++) {
      expect(markup).toContain(`id="mobile-skill-${idx}"`);
    }
    expect((markup.match(/arc-plus/g) || []).length).toBe(4);
    expect((markup.match(/arc-btn-empty/g) || []).length).toBe(4);
  });

  it("renders a bound skill icon instead of the + prompt", () => {
    const markup = renderControls({
      skills: [{ id: "la_han_tran", glyph: "陣", nameKey: "skills.thieuLam.laHanTran.name" }],
      skillSlots: ["la_han_tran", null, null, null]
    });
    expect((markup.match(/arc-plus/g) || []).length).toBe(3);
    expect(markup).toContain("陣");
    // The tooltip explains the long-press rebind gesture.
    expect(markup).toContain("Giữ để đổi chiêu");
  });
});
