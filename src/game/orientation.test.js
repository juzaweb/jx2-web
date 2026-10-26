// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isMobileDevice, requestLandscapeFullscreen, usesTouchControls } from "./orientation.js";

describe("orientation.js", () => {
  let originalUserAgent;
  let originalInnerWidth;
  let originalMatchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalUserAgent = window.navigator.userAgent;
    originalInnerWidth = window.innerWidth;
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true
    });
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      configurable: true
    });
    Object.defineProperty(window, "matchMedia", {
      value: originalMatchMedia,
      configurable: true,
      writable: true
    });
  });

  describe("isMobileDevice", () => {
    it("detects mobile user agents (Android, iPhone, iPad)", () => {      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        configurable: true
      });
      expect(isMobileDevice()).toBe(true);

      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36",
        configurable: true
      });
      expect(isMobileDevice()).toBe(true);
    });

    it("detects touch devices with mobile viewport width", () => {
      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        configurable: true
      });
      Object.defineProperty(window.navigator, "maxTouchPoints", {
        value: 5,
        configurable: true
      });
      Object.defineProperty(window, "innerWidth", {
        value: 768,
        configurable: true
      });

      expect(isMobileDevice()).toBe(true);
    });

    it("returns false for standard desktop browser", () => {
      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        configurable: true
      });
      Object.defineProperty(window.navigator, "maxTouchPoints", {
        value: 0,
        configurable: true
      });
      Object.defineProperty(window, "innerWidth", {
        value: 1920,
        configurable: true
      });

      expect(isMobileDevice()).toBe(false);
    });
  });

  describe("requestLandscapeFullscreen", () => {
    it("skips execution on desktop when force is false", async () => {      Object.defineProperty(window.navigator, "userAgent", {
        value: "Desktop Chrome",
        configurable: true
      });
      Object.defineProperty(window.navigator, "maxTouchPoints", {
        value: 0,
        configurable: true
      });

      const result = await requestLandscapeFullscreen(false);
      expect(result).toBe(false);
    });

    it("calls requestFullscreen and orientation.lock when forced or mobile", async () => {
      const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
      const lockMock = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(document.documentElement, "requestFullscreen", {
        value: requestFullscreenMock,
        configurable: true
      });

      Object.defineProperty(window, "screen", {
        value: {
          orientation: {
            lock: lockMock
          }
        },
        configurable: true
      });

      const result = await requestLandscapeFullscreen(true);

      expect(requestFullscreenMock).toHaveBeenCalled();
      expect(lockMock).toHaveBeenCalledWith("landscape");
      expect(result).toBe(true);
    });

    it("handles errors gracefully if requestFullscreen or lock throws", async () => {
      const requestFullscreenMock = vi.fn().mockRejectedValue(new Error("Permission denied"));
      const lockMock = vi.fn().mockRejectedValue(new Error("Not supported"));

      Object.defineProperty(document.documentElement, "requestFullscreen", {
        value: requestFullscreenMock,
        configurable: true
      });

      Object.defineProperty(window, "screen", {
        value: {
          orientation: {
            lock: lockMock
          }
        },
        configurable: true
      });

      const result = await requestLandscapeFullscreen(true);
      expect(result).toBe(false);
    });
  });

  describe("usesTouchControls", () => {
    const stubMatchMedia = (matchesByQuery) => {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: (query) => ({ matches: Boolean(matchesByQuery[query]) })
      });
    };

    const setDesktop = () => {
      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        configurable: true
      });
      Object.defineProperty(window.navigator, "maxTouchPoints", {
        value: 0,
        configurable: true
      });
      Object.defineProperty(window, "innerWidth", { value: 1920, configurable: true });
    };

    it("is true on a mobile device", () => {
      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        configurable: true
      });
      stubMatchMedia({});

      expect(usesTouchControls()).toBe(true);
    });

    it("follows the touch-layout media queries on desktop", () => {
      setDesktop();

      stubMatchMedia({ "(pointer: coarse)": true });
      expect(usesTouchControls()).toBe(true);

      stubMatchMedia({ "(max-width: 960px)": true });
      expect(usesTouchControls()).toBe(true);

      stubMatchMedia({ "(max-height: 500px)": true });
      expect(usesTouchControls()).toBe(true);

      stubMatchMedia({});
      expect(usesTouchControls()).toBe(false);
    });
  });
});
