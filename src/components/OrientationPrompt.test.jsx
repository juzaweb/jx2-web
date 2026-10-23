import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { OrientationPrompt } from "./OrientationPrompt.jsx";
import { I18nProvider } from "../i18n/I18nProvider.jsx";

describe("OrientationPrompt logic and SSR rendering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render HTML string in SSR when window is not defined or forceShow is false in landscape", () => {
    Object.defineProperty(global, "window", {
      writable: true,
      configurable: true,
      value: { innerWidth: 1024, innerHeight: 768, addEventListener: () => {}, removeEventListener: () => {} }
    });

    const html = renderToString(
      <I18nProvider>
        <OrientationPrompt forceShow={false} />
      </I18nProvider>
    );

    expect(html).toBe("");
  });

  it("renders overlay HTML when forceShow is true", () => {
    Object.defineProperty(global, "window", {
      writable: true,
      configurable: true,
      value: { innerWidth: 1024, innerHeight: 768, addEventListener: () => {}, removeEventListener: () => {} }
    });

    const html = renderToString(
      <I18nProvider>
        <OrientationPrompt forceShow={true} />
      </I18nProvider>
    );

    expect(html).toContain("orientation-overlay");
    expect(html).toContain("XOAY NGANG MÀN HÌNH");
    expect(html).toContain("Vui lòng xoay ngang điện thoại để trải nghiệm game tốt nhất.");
  });

  it("renders overlay HTML when portrait mode is active", () => {
    Object.defineProperty(global, "window", {
      writable: true,
      configurable: true,
      value: { innerWidth: 375, innerHeight: 812, addEventListener: () => {}, removeEventListener: () => {} }
    });

    const html = renderToString(
      <I18nProvider>
        <OrientationPrompt forceShow={false} />
      </I18nProvider>
    );

    expect(html).toContain("orientation-overlay");
    expect(html).toContain("orientation-rotate-btn");
    expect(html).toContain("orientation-dismiss-btn");
  });
});
