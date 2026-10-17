import { describe, it, expect, afterEach, vi } from "vitest";
import { bridge, EVENTS } from "./bridge.js";

describe("GameEventBridge", () => {
  afterEach(() => {
    bridge.clear();
  });

  it("delivers an emitted payload to subscribers", () => {
    const handler = vi.fn();
    bridge.on(EVENTS.LOG_ADDED, handler);

    bridge.emit(EVENTS.LOG_ADDED, { text: "Chào hiệp khách" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ text: "Chào hiệp khách" });
  });

  it("stops delivery after unsubscribe", () => {
    const handler = vi.fn();
    const off = bridge.on(EVENTS.STATS_UPDATED, handler);
    off();

    bridge.emit(EVENTS.STATS_UPDATED, { hp: 50 });

    expect(handler).not.toHaveBeenCalled();
  });

  it("isolates a throwing handler from other subscribers", () => {
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    bridge.on(EVENTS.STATS_UPDATED, bad);
    bridge.on(EVENTS.STATS_UPDATED, good);

    expect(() => bridge.emit(EVENTS.STATS_UPDATED, { hp: 1 })).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when emitting with no subscribers", () => {
    expect(() => bridge.emit(EVENTS.GAME_PAUSED, true)).not.toThrow();
  });
});
