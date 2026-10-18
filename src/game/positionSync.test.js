import { describe, it, expect } from "vitest";
import { TELEPORT_REPORT_THRESHOLD, shouldReportPosition } from "./positionSync.js";

describe("shouldReportPosition", () => {
  it("reports while the player is moving", () => {
    expect(
      shouldReportPosition({ isMoving: true, wasMoving: false, x: 0, y: 0, lastReported: { x: 0, y: 0 } })
    ).toBe(true);
  });

  it("reports the final packet on the stop transition", () => {
    expect(
      shouldReportPosition({ isMoving: false, wasMoving: true, x: 10, y: 0, lastReported: { x: 5, y: 0 } })
    ).toBe(true);
  });

  it("stays quiet while resting on the reported spot", () => {
    expect(
      shouldReportPosition({ isMoving: false, wasMoving: false, x: 100, y: 100, lastReported: { x: 100, y: 100 } })
    ).toBe(false);
  });

  it("ignores the tiny drift between packets while resting", () => {
    expect(
      shouldReportPosition({ isMoving: false, wasMoving: false, x: 105, y: 100, lastReported: { x: 100, y: 100 } })
    ).toBe(false);
  });

  it("reports a respawn/teleport jump even while stationary", () => {
    const near = shouldReportPosition({
      isMoving: false,
      wasMoving: false,
      x: 100 + TELEPORT_REPORT_THRESHOLD - 1,
      y: 100,
      lastReported: { x: 100, y: 100 }
    });
    const far = shouldReportPosition({
      isMoving: false,
      wasMoving: false,
      x: 640,
      y: 620,
      lastReported: { x: 1400, y: 900 }
    });

    expect(near).toBe(false);
    expect(far).toBe(true);
  });

  it("reports the first position so peers never start stale", () => {
    expect(
      shouldReportPosition({ isMoving: false, wasMoving: false, x: 640, y: 620, lastReported: null })
    ).toBe(true);
    expect(shouldReportPosition({ isMoving: false, wasMoving: false, x: 640, y: 620 })).toBe(true);
  });
});
