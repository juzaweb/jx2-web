import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
import { InventoryModal } from "./InventoryModal.jsx";

const sampleItem = {
  id: "potion_hp_small",
  name: "Kim Sáng Dược (Tiểu)",
  icon: "potion-red",
  qty: 5,
  useSlot: 1
};

describe("InventoryModal", () => {
  it("renders nothing when isOpen is false", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <InventoryModal isOpen={false} onClose={() => {}} />
      </I18nProvider>
    );
    expect(markup).toBe("");
  });

  it("renders inventory title, grid, weight and currency when open", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <InventoryModal
          isOpen
          onClose={() => {}}
          coins={12500}
          inventoryItems={[sampleItem, null]}
        />
      </I18nProvider>
    );
    expect(markup).toContain('id="inventory-modal"');
    expect(markup).toContain("Hành trang");
    expect(markup).toContain("inv-grid");
    expect(markup).toContain("inv-weight");
    expect(markup).toContain("inv-currency-row");
    expect(markup).toContain("potion-red");
    expect(markup).toContain("x5");
  });

  it("does not render tab switch bar when open", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <InventoryModal
          isOpen
          onClose={() => {}}
        />
      </I18nProvider>
    );
    expect(markup).not.toContain("inv-tabs");
  });
});

