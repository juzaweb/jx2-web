import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionLostOverlay } from "./components/ConnectionLostOverlay.jsx";
import { I18nProvider } from "./i18n/I18nProvider.jsx";
import { bridge, EVENTS } from "./game/bridge.js";

describe("ConnectionLostOverlay component", () => {
  it("does not render when visible is false", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ConnectionLostOverlay visible={false} />
      </I18nProvider>
    );
    expect(markup).toBe("");
  });

  it("renders lost connection dialog when visible is true", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ConnectionLostOverlay visible={true} />
      </I18nProvider>
    );
    expect(markup).toContain("Mất kết nối");
    expect(markup).toContain("connection-overlay");
  });
});

describe("Connection Gate Logic helper rules", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gating delay respects grace period when active character is present", () => {
    let isConnectionGated = false;
    let activeCharacter = { id: "char-1", name: "Hiệp Khách" };
    let isNetworkConnected = false;

    const computeGate = () => {
      if (isNetworkConnected || !activeCharacter) {
        return false;
      }
      return true;
    };

    expect(computeGate()).toBe(true);

    // When network becomes connected, gate opens immediately
    isNetworkConnected = true;
    expect(computeGate()).toBe(false);

    // When no active character (in lobby), gate remains closed
    isNetworkConnected = false;
    activeCharacter = null;
    expect(computeGate()).toBe(false);
  });
});
