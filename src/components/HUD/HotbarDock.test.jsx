import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HotbarDock } from "./HotbarDock.jsx";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";

const renderDockMarkup = (props = {}) => {
  return renderToStaticMarkup(
    <I18nProvider>
      <HotbarDock skills={[]} {...props} />
    </I18nProvider>
  );
};

describe("HotbarDock logic & props", () => {
  it("renders 9 quick slots defaulting to empty", () => {
    const markup = renderDockMarkup();
    for (let i = 1; i <= 9; i++) {
      expect(markup).toContain(`id="slot-${i}"`);
    }
    // All 9 slots contain class slot-item empty
    const emptyCount = (markup.match(/class="slot-item empty"/g) || []).length;
    expect(emptyCount).toBe(9);
  });

  it("renders an assigned item in a quick slot", () => {
    const quickSlotsMapping = { 1: "kim-sang-duoc" };
    const items = [{ id: "kim-sang-duoc", name: "Kim Sáng Dược", icon: "icon-hp-pot", qty: 10 }];

    const markup = renderDockMarkup({ quickSlotsMapping, items });

    expect(markup).toContain('id="slot-1"');
    expect(markup).toContain('class="item-icon icon-hp-pot"');
    expect(markup).toContain('id="qty-kim-sang-duoc">10</span>');

    // Slot 1 is no longer empty, so 8 empty slots remain
    const emptyCount = (markup.match(/class="slot-item empty"/g) || []).length;
    expect(emptyCount).toBe(8);
  });

  it("renders an assigned skill in a numbered slot with its cooldown layer", () => {
    const quickSlotsMapping = { 2: "skill:dai_tu_di_chuong" };
    const skills = [
      {
        id: "dai_tu_di_chuong",
        glyph: "掌",
        nameKey: "skills.thieuLam.daiTuDiChuong.name"
      }
    ];

    const markup = renderDockMarkup({ quickSlotsMapping, skills });

    expect(markup).toContain('id="slot-2"');
    expect(markup).toContain('class="slot-item skill-binding"');
    expect(markup).toContain("slot-skill-icon");
    expect(markup).toContain('data-skill-id="dai_tu_di_chuong"');

    // Slot 2 is no longer empty, so 8 empty slots remain.
    const emptyCount = (markup.match(/class="slot-item empty"/g) || []).length;
    expect(emptyCount).toBe(8);
  });

  it("memoizes quick slots calculation and updates when quickSlotsMapping or items change", () => {
    const initialMapping = { 1: "kim-sang-duoc" };
    const items = [{ id: "kim-sang-duoc", name: "Kim Sáng Dược", icon: "icon-hp-pot", qty: 10 }];

    const markup1 = renderDockMarkup({ quickSlotsMapping: initialMapping, items });
    expect(markup1).toContain('id="qty-kim-sang-duoc">10</span>');

    const updatedMapping = { 1: "kim-sang-duoc", 2: "dai-hoan-dan" };
    const items2 = [
      { id: "kim-sang-duoc", name: "Kim Sáng Dược", icon: "icon-hp-pot", qty: 10 },
      { id: "dai-hoan-dan", name: "Đại Hoàn Đan", icon: "icon-mp-pot", qty: 5 }
    ];

    const markup2 = renderDockMarkup({ quickSlotsMapping: updatedMapping, items: items2 });
    expect(markup2).toContain('id="qty-kim-sang-duoc">10</span>');
    expect(markup2).toContain('id="qty-dai-hoan-dan">5</span>');
  });

  it("marks the whole numbered bar as a drop target for dragged items", () => {
    const markup = renderDockMarkup();

    expect(markup).toContain('data-hotbar-strip=""');
    for (let i = 1; i <= 9; i++) {
      expect(markup).toContain(`data-hotbar-slot="${i}"`);
    }
  });

  it("renders skills button with 'Võ Công' label and hotkey title", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <HotbarDock skills={[]} />
      </I18nProvider>
    );
    expect(markup).toContain('id="skills-btn"');
    expect(markup).toContain('title="Võ Công (F5)"');
    expect(markup).toContain('<span class="sys-lbl">Võ Công</span>');
  });
});
