import { describe, expect, it } from "vitest";
import { clampPanelPosition, PANEL_EDGE } from "./useDraggablePanel.js";

const viewport = { viewportWidth: 1280, viewportHeight: 800 };

describe("clampPanelPosition", () => {
  it("keeps a panel that is already inside the viewport", () => {
    expect(
      clampPanelPosition({ ...viewport, x: 100, y: 50, width: 400, height: 300 })
    ).toEqual({ x: 100, y: 50 });
  });

  it("pulls a panel back to the edge when dragged past the top-left", () => {
    expect(
      clampPanelPosition({ ...viewport, x: -120, y: -40, width: 400, height: 300 })
    ).toEqual({ x: PANEL_EDGE, y: PANEL_EDGE });
  });

  it("pulls a panel back from the bottom-right corner", () => {
    expect(
      clampPanelPosition({ ...viewport, x: 1200, y: 700, width: 400, height: 300 })
    ).toEqual({ x: 1280 - 400 - PANEL_EDGE, y: 800 - 300 - PANEL_EDGE });
  });

  it("pins oversized panels to the top-left instead of pushing them off-screen", () => {
    expect(
      clampPanelPosition({ ...viewport, x: 400, y: 400, width: 1500, height: 900 })
    ).toEqual({ x: PANEL_EDGE, y: PANEL_EDGE });
  });

  it("honours a custom edge margin", () => {
    expect(
      clampPanelPosition({
        ...viewport,
        x: -10,
        y: -10,
        width: 400,
        height: 300,
        edge: 20
      })
    ).toEqual({ x: 20, y: 20 });
  });
});
