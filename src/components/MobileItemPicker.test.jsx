import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../i18n/I18nProvider.jsx";
import { MobileItemPicker } from "./MobileItemPicker.jsx";

const items = [
  { id: "kim-sang-duoc", name: "Kim Sáng Dược", icon: "icon-hp-pot", desc: "", qty: 9 },
  { id: "dai-hoan-dan", name: "Đại Hoàn Đan", icon: "icon-mp-pot", desc: "", qty: 0 }
];

const renderPicker = (props = {}) =>
  renderToStaticMarkup(
    <I18nProvider>
      <MobileItemPicker isOpen={true} items={items} {...props} />
    </I18nProvider>
  );

describe("MobileItemPicker", () => {
  it("renders nothing when closed", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MobileItemPicker isOpen={false} items={items} />
      </I18nProvider>
    );
    expect(markup).toBe("");
  });

  it("lists the consumables with their stack count", () => {
    const markup = renderPicker({ slotIndex: 1 });

    expect(markup).toContain("Chọn vật phẩm cho nút 2");
    expect(markup).toContain("Kim Sáng Dược");
    expect(markup).toContain("×9");
    expect(markup).toContain("icon-hp-pot");
  });

  it("keeps an out-of-stock item visible but disabled", () => {
    const markup = renderPicker();

    expect(markup).toContain("Đại Hoàn Đan");
    expect(markup).toContain("mobile-picker-row locked");
    expect(markup).toContain("Hết");
  });

  it("shows the clear action only for a bound button", () => {
    expect(renderPicker()).not.toContain("mobile-picker-clear");
    expect(renderPicker({ selectedItemId: "kim-sang-duoc" })).toContain(
      "mobile-picker-clear"
    );
  });
});
