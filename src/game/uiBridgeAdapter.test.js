import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bridge, EVENTS } from "./bridge.js";
import { UIBridgeAdapter } from "./uiBridgeAdapter.js";

const makeCtx = () => ({
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1
});

const makeCanvas = (ctx = makeCtx()) => ({
  width: 168,
  height: 116,
  getContext: vi.fn(() => ctx)
});

describe("UIBridgeAdapter minimap registration", () => {
  beforeEach(() => bridge.clear());
  afterEach(() => bridge.clear());

  it("re-requests the minimap so a panel that mounted first gets re-registered", () => {
    const ctx = makeCtx();
    const canvas = makeCanvas(ctx);

    // The panel mounted before the adapter existed: it registered once (lost) and
    // now stands ready to answer the adapter's request.
    bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, { canvas, coordsEl: null });
    const responder = bridge.on(EVENTS.ACTION_REQUEST_MINIMAP, () => {
      bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, { canvas, coordsEl: null });
    });

    const adapter = new UIBridgeAdapter();

    expect(adapter.minimapCtx).toBe(ctx);
    responder();
  });

  it("binds a registration that arrives after the adapter exists", () => {
    const ctx = makeCtx();
    const adapter = new UIBridgeAdapter();

    bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, { canvas: makeCanvas(ctx), coordsEl: null });

    expect(adapter.minimapCtx).toBe(ctx);
  });

  it("draws player, enemy and remote-player blips once bound", () => {
    const ctx = makeCtx();
    const adapter = new UIBridgeAdapter();
    bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, { canvas: makeCanvas(ctx), coordsEl: null });

    adapter.drawMinimap(
      { x: 640, y: 620 },
      [{ x: 840, y: 600, active: true, isDead: false }],
      { width: 2200, height: 1250 },
      // RemotePlayer renders through `container`, not a physics `sprite`
      [{ x: 700, y: 640, container: { active: true } }]
    );

    expect(ctx.fillRect).toHaveBeenCalled();
    // 1 enemy + 1 remote + the player beacon at minimum
    expect(ctx.arc.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("skips a remote player that has been destroyed (no live container)", () => {
    const ctx = makeCtx();
    const adapter = new UIBridgeAdapter();
    bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, { canvas: makeCanvas(ctx), coordsEl: null });

    adapter.drawMinimap(
      { x: 640, y: 620 },
      [],
      { width: 2200, height: 1250 },
      [{ x: 700, y: 640, container: { active: false } }, { x: 720, y: 660 }]
    );

    // Only the player sight-radius arc + center dot remain
    expect(ctx.arc.mock.calls.length).toBe(2);
  });

  it("does nothing before a canvas is bound", () => {
    const adapter = new UIBridgeAdapter();
    expect(() =>
      adapter.drawMinimap({ x: 0, y: 0 }, [], { width: 2200, height: 1250 })
    ).not.toThrow();
  });
});
