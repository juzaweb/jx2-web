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
    // Four skill slots plus the two consumable slots all start as "+".
    expect((markup.match(/arc-plus/g) || []).length).toBe(6);
    expect((markup.match(/arc-btn-empty/g) || []).length).toBe(6);
  });

  it("renders the two consumable buttons unassigned by default", () => {
    const markup = renderControls();
    expect(markup).toContain('id="mobile-item-0"');
    expect(markup).toContain('id="mobile-item-1"');
    // The column position comes from the slot index, not a hard-coded class.
    expect(markup).toContain("--item-slot:0");
    expect(markup).toContain("--item-slot:1");
    expect(markup).toContain("Chưa gán vật phẩm");
  });

  it("marks a bound consumable the bag has run out of", () => {
    const markup = renderControls({
      items: [{ id: "dai-hoan-dan", name: "Đại Hoàn Đan", icon: "icon-mp-pot", qty: 0 }],
      itemSlots: ["dai-hoan-dan", null]
    });
    expect(markup).toContain("is-out-of-stock");
    // The label states the stock problem rather than the rebind hint...
    expect(markup).toContain("Hết");
    // ...and no quantity badge is rendered for an empty stack.
    expect(markup).not.toContain('class="arc-badge">0<');
  });

  it("renders a bound consumable with its bag count", () => {
    const markup = renderControls({
      items: [{ id: "kim-sang-duoc", name: "Kim Sáng Dược", icon: "icon-hp-pot", qty: 7 }],
      itemSlots: [null, "kim-sang-duoc"]
    });
    expect(markup).toContain("icon-hp-pot");
    expect(markup).toContain(">7<");
    expect(markup).toContain("Giữ để đổi vật phẩm");
  });

  it("renders a bound skill icon instead of the + prompt", () => {
    const markup = renderControls({
      skills: [{ id: "la_han_tran", glyph: "陣", nameKey: "skills.thieuLam.laHanTran.name" }],
      skillSlots: ["la_han_tran", null, null, null]
    });
    // Three empty skills plus the two unbound consumable buttons still show "+".
    expect((markup.match(/arc-plus/g) || []).length).toBe(5);
    expect(markup).toContain("陣");
    // The tooltip explains the long-press rebind gesture.
    expect(markup).toContain("Giữ để đổi chiêu");
  });

  it("lets CSS place every arc slot by its ring index", () => {
    const markup = renderControls();
    // Slots carry --i so index.css can compute the angle; no per-slot offsets
    // live in JS or in index-specific classes any more.
    for (let idx = 0; idx < 4; idx++) {
      expect(markup).toContain(`--i:${idx}`);
      expect(markup).not.toContain(`arc-skill-${idx}`);
    }
    expect((markup.match(/arc-orbit/g) || []).length).toBe(4); // skills only
    // Potions live outside the fan, in their own column.
    expect((markup.match(/arc-btn-potion/g) || []).length).toBe(2);
  });
});
