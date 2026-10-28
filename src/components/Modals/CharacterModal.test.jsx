import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
import { CharacterModal } from "./CharacterModal.jsx";

const renderSheet = () =>
  renderToStaticMarkup(
    <I18nProvider>
      <CharacterModal isOpen onClose={() => {}} stats={{ level: 1 }} />
    </I18nProvider>
  );

describe("CharacterModal stats sheet", () => {
  it("shows the combat stats that have a backing model", () => {
    const markup = renderSheet();
    for (const key of ["physicalAtk", "physicalDef", "crit", "critDamage", "attackSpeed"]) {
      expect(markup).toContain(`data-stat="${key}"`);
    }
  });

  it("does not show stats the game never applies", () => {
    const markup = renderSheet();
    for (const key of [
      "damage",
      "chiAtk",
      "accuracy",
      "magicDef",
      "dodge",
      "burst",
      "burstHard",
      "woundRate",
      "critResist",
      "cast",
      "moveSpeed",
      "strength",
      "agility",
      "internal",
      "bone",
      "flexibility"
    ]) {
      expect(markup).not.toContain(`data-stat="${key}"`);
    }
  });

  it("exposes the paper-doll slots as pointer drop zones", () => {
    const markup = renderSheet();
    expect(markup).toContain('class="equip-slot"');
    // Only slots backed by an equipment key accept a dropped item.
    expect(markup).toContain('data-equip-slot="weapon"');
    expect(markup).toContain('data-equip-slot="armor"');
    expect(markup).not.toContain('data-equip-slot="undefined"');
  });

  it("renders quick switch tab to inventory when onSwitchToInventory is provided", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <CharacterModal
          isOpen
          onClose={() => {}}
          onSwitchToInventory={() => {}}
          stats={{ level: 1 }}
        />
      </I18nProvider>
    );
    expect(markup).toContain("Hành trang");
  });
});
