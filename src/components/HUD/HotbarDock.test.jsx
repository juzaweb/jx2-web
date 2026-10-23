import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HotbarDock } from "./HotbarDock.jsx";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";

const renderDockMarkup = (props = {}) => {
  return renderToStaticMarkup(
    <I18nProvider>
      <HotbarDock skills={[]} skillLoadout={{ u: 0, i: 1, o: 2, p: 3 }} {...props} />
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
