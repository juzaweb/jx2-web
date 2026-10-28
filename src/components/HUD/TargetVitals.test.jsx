import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TargetVitals } from "./TargetVitals.jsx";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";

const renderTargetVitals = (props = {}) => {
  return renderToStaticMarkup(
    <I18nProvider>
      <TargetVitals {...props} />
    </I18nProvider>
  );
};

describe("TargetVitals component", () => {
  it("renders nothing when target is null", () => {
    const markup = renderTargetVitals({ target: null });
    expect(markup).toBe("");
  });

  it("renders monster target details and health percentage correctly", () => {
    const target = {
      id: "wolf-1",
      name: "Dã Lang",
      level: 3,
      hp: 150,
      maxHp: 200,
      kind: "monster",
      isBoss: false
    };

    const markup = renderTargetVitals({ target });

    expect(markup).toContain('id="target-hud"');
    expect(markup).toContain("Dã Lang");
    expect(markup).toContain("3");
    expect(markup).toContain("150 / 200 (75%)");
    expect(markup).toContain('style="width:75%"');
    expect(markup).toContain("Quái vật");
  });

  it("renders boss target badge when isBoss is true", () => {
    const target = {
      id: "boss-1",
      name: "Cự Lang Vương",
      level: 10,
      hp: 5000,
      maxHp: 5000,
      kind: "monster",
      isBoss: true
    };

    const markup = renderTargetVitals({ target });

    expect(markup).toContain("Cự Lang Vương");
    expect(markup).toContain("is-boss");
    expect(markup).toContain("Thủ Lĩnh");
  });

  it("renders duelist badge when target kind is player", () => {
    const target = {
      id: "peer-99",
      name: "Độc Cô Cầu Bại",
      level: 50,
      hp: 800,
      maxHp: 1000,
      kind: "player"
    };

    const markup = renderTargetVitals({ target });

    expect(markup).toContain("Độc Cô Cầu Bại");
    expect(markup).toContain("is-pvp");
    expect(markup).toContain("Tỷ Thí");
  });
});

