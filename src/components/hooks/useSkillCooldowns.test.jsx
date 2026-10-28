// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useSkillCooldowns } from "./useSkillCooldowns.js";
import { bridge, EVENTS } from "../../game/bridge.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useSkillCooldowns hook", () => {
  let container;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    bridge.clear();
  });

  it("tracks remaining cooldown and percentage when SKILL_CAST is emitted", () => {
    let hookResult;
    function TestComponent() {
      hookResult = useSkillCooldowns();
      return null;
    }

    act(() => {
      root.render(<TestComponent />);
    });

    expect(hookResult("any_skill")).toBe(0);
    expect(hookResult.percent("any_skill")).toBe(0);

    act(() => {
      bridge.emit(EVENTS.SKILL_CAST, { skillId: "test_skill", cooldown: 4000 });
    });

    expect(hookResult("test_skill")).toBeGreaterThan(0);
    expect(hookResult.percent("test_skill", 4000)).toBeCloseTo(100, 0);

    // Advance clock past 2000ms (in multiples of 60ms interval tick)
    act(() => {
      vi.advanceTimersByTime(2040);
    });

    expect(hookResult("test_skill")).toBeLessThanOrEqual(2000);
    expect(hookResult.percent("test_skill", 4000)).toBeLessThanOrEqual(51);

    // Advance past end
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(hookResult("test_skill")).toBe(0);
    expect(hookResult.percent("test_skill", 4000)).toBe(0);
  });
});

