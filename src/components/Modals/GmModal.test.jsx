import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
import { GmModal } from "./GmModal.jsx";

const renderModal = (props = {}) =>
  renderToStaticMarkup(
    <I18nProvider>
      <GmModal isOpen onClose={() => {}} stats={{ level: 50, hp: 500, maxHp: 1000 }} {...props} />
    </I18nProvider>
  );

describe("GmModal Component", () => {
  it("renders properly when isOpen is true", () => {
    const markup = renderModal();
    expect(markup).toContain('id="gm-modal"');
    expect(markup).toContain("Lệnh Bài GM");
    expect(markup).toContain("Đẳng Cấp");
    expect(markup).toContain("Dược Phẩm");
    expect(markup).toContain("Truyền Tống");
    expect(markup).toContain("Tiện Ích");
  });

  it("does not render when isOpen is false", () => {
    const markup = renderModal({ isOpen: false });
    expect(markup).toBe("");
  });

  it("renders level milestones and custom level input", () => {
    const markup = renderModal();
    expect(markup).toContain("Cấp 10");
    expect(markup).toContain("Cấp 50");
    expect(markup).toContain("Cấp 73 (Bí Kíp)");
    expect(markup).toContain("Cấp 99 (Đại Hiệp)");
    expect(markup).toContain("Max Cấp (150)");
    expect(markup).toContain('type="number"');
    expect(markup).toContain("Đặt Cấp");
  });
});

