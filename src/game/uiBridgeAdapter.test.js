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

const WORLD = { width: 2200, height: 1250 };

/** True when a blip arc was drawn at the canvas point for world (wx, wy). */
const blipDrawnAt = (ctx, wx, wy) => {
  const cx = wx * (168 / WORLD.width);
  const cy = wy * (116 / WORLD.height);
  return ctx.arc.mock.calls.some(
    ([ax, ay]) => Math.abs(ax - cx) < 1e-6 && Math.abs(ay - cy) < 1e-6
  );
};

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
      WORLD,
      // RemotePlayer renders through `container`, not a physics `sprite`
      [{ x: 700, y: 640, container: { active: true } }]
    );

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(blipDrawnAt(ctx, 840, 600)).toBe(true); // enemy
    expect(blipDrawnAt(ctx, 700, 640)).toBe(true); // remote player
    expect(blipDrawnAt(ctx, 640, 620)).toBe(true); // local player beacon
  });

  it("skips a remote player that has been destroyed (no live container)", () => {
    const ctx = makeCtx();
    const adapter = new UIBridgeAdapter();
    bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, { canvas: makeCanvas(ctx), coordsEl: null });

    adapter.drawMinimap(
      { x: 640, y: 620 },
      [],
      WORLD,
      [{ x: 700, y: 640, container: { active: false } }, { x: 720, y: 660 }]
    );

    expect(blipDrawnAt(ctx, 700, 640)).toBe(false);
    expect(blipDrawnAt(ctx, 720, 660)).toBe(false);
    expect(blipDrawnAt(ctx, 640, 620)).toBe(true); // the local player is still drawn
  });

  it("does nothing before a canvas is bound", () => {
    const adapter = new UIBridgeAdapter();
    expect(() =>
      adapter.drawMinimap({ x: 0, y: 0 }, [], { width: 2200, height: 1250 })
    ).not.toThrow();
  });
});
