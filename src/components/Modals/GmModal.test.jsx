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
    expect(markup).toContain("Trang Phục");
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
    expect(markup).toContain("Max Cấp (99)");
    expect(markup).toContain("Tùy chọn cấp độ (1 - 99)");
    expect(markup).toContain('type="number"');
    expect(markup).toContain("Đặt Cấp");
  });

  it("renders weapons and skill books options in equipment tab", () => {
    const markup = renderModal({ initialTab: "equipment" });
    // Costumes
    expect(markup).toContain("Bộ Y Phục Lãng Khách");
    expect(markup).toContain("Nón Lãng Khách");
    expect(markup).toContain("Áo Lãng Khách");
    expect(markup).toContain("Quần Lãng Khách");
    expect(markup).toContain("Nhận Trọn Bộ Y Phục");

    // Weapons
    expect(markup).toContain("Vũ Khí Lãng Khách");
    expect(markup).toContain("Kiếm Lãng Khách");
    expect(markup).toContain("Đao Lãng Khách");
    expect(markup).toContain("Bao Tay Lãng Khách");
    expect(markup).toContain("Nhận Trọn Bộ Vũ Khí");

    // Skill Books
    expect(markup).toContain("Bí Kíp Võ Học (Sách Kỹ Năng)");
    expect(markup).toContain("Nhận Toàn Bộ Bí Kíp (18 Cuốn)");
    expect(markup).toContain("Bí Kíp Thiếu Lâm (6)");
    expect(markup).toContain("Bí Kíp Võ Đang (4)");
    expect(markup).toContain("Bí Kíp Nga My (4)");
    expect(markup).toContain("Bí Kíp Ngũ Độc (4)");
  });
});

