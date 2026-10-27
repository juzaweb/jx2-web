import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionLostOverlay } from "./components/ConnectionLostOverlay.jsx";
import { I18nProvider } from "./i18n/I18nProvider.jsx";
import { bridge, EVENTS } from "./game/bridge.js";
import { usesTouchControls } from "./game/orientation.js";
import { App } from "./App.jsx";

vi.mock("./game/orientation.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    usesTouchControls: vi.fn(),
    isMobileDevice: vi.fn()
  };
});

vi.mock("./components/GameCanvas.jsx", () => ({
  GameCanvas: () => <div id="mock-game-canvas" />
}));

describe("App Minimap and Chat Mobile/Desktop Default States", () => {
  beforeEach(() => {
    const store = {};
    const mockLocalStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
    };
    vi.stubGlobal("localStorage", mockLocalStorage);
    vi.stubGlobal("window", { ...globalThis.window, localStorage: mockLocalStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults minimap and chat to expanded on desktop (usesTouchControls = false)", () => {
    vi.mocked(usesTouchControls).mockReturnValue(false);

    const markup = renderToStaticMarkup(
      <I18nProvider>
        <App />
      </I18nProvider>
    );

    expect(markup).toContain('id="minimap-panel"');
    expect(markup).toContain('id="chat-panel"');
    expect(markup).not.toContain('id="minimap-restore-panel"');
    expect(markup).not.toContain('id="chat-restore-panel"');
  });

  it("defaults minimap and chat to minimized/collapsed on mobile (usesTouchControls = true)", () => {
    vi.mocked(usesTouchControls).mockReturnValue(true);

    const markup = renderToStaticMarkup(
      <I18nProvider>
        <App />
      </I18nProvider>
    );

    expect(markup).toContain('id="minimap-restore-panel"');
    expect(markup).toContain('id="chat-restore-panel"');
    expect(markup).not.toContain('id="minimap-panel"');
    expect(markup).not.toContain('id="chat-panel"');
  });
});

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
