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

  it("centers the local radar on the player and spans one tenth of the city", () => {
    const ctx = makeCtx();
    const canvas = makeCanvas(ctx);
    const adapter = new UIBridgeAdapter();
    bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, { canvas, coordsEl: null });

    const city = { x0: 0, y0: 0, x1: 2200, y1: 1250 };
    const player = { x: 1100, y: 625 };
    const aspect = canvas.width / canvas.height;
    const spanX = Math.sqrt((((city.x1 - city.x0) * (city.y1 - city.y0)) / 10) * aspect);
    // A blip on the east edge of the radar view.
    const edge = { x: player.x + spanX / 2, y: player.y, active: true, isDead: false };

    adapter.drawMinimap(player, [edge], { width: 4400, height: 2500, cityBounds: city });

    const hasArcAt = (ax, ay) =>
      ctx.arc.mock.calls.some(
        ([x, y]) => Math.abs(x - ax) < 1e-6 && Math.abs(y - ay) < 1e-6
      );

    expect(hasArcAt(canvas.width / 2, canvas.height / 2)).toBe(true); // player centred
    expect(hasArcAt(canvas.width, canvas.height / 2)).toBe(true); // 1/10 span edge
  });
});

describe("UIBridgeAdapter full-city map", () => {
  beforeEach(() => bridge.clear());
  afterEach(() => bridge.clear());

  const CITY_WORLD = {
    width: 4400,
    height: 2500,
    cityBounds: { x0: 0, y0: 0, x1: 2200, y1: 1250 }
  };

  it("re-requests the city map so a modal that mounted first gets re-registered", () => {
    const ctx = makeCtx();
    const canvas = makeCanvas(ctx);

    bridge.emit(EVENTS.ACTION_REGISTER_CITY_MAP, { canvas });
    const responder = bridge.on(EVENTS.ACTION_REQUEST_CITY_MAP, () => {
      bridge.emit(EVENTS.ACTION_REGISTER_CITY_MAP, { canvas });
    });

    const adapter = new UIBridgeAdapter();

    expect(adapter.cityMapCtx).toBe(ctx);
    responder();
  });

  it("clears the bound canvas when the modal unregisters", () => {
    const adapter = new UIBridgeAdapter();
    bridge.emit(EVENTS.ACTION_REGISTER_CITY_MAP, { canvas: makeCanvas() });
    expect(adapter.cityMapCanvas).not.toBeNull();

    bridge.emit(EVENTS.ACTION_REGISTER_CITY_MAP, { canvas: null });
    expect(adapter.cityMapCanvas).toBeNull();
    expect(adapter.cityMapCtx).toBeNull();
  });

  it("draws the whole city into the modal canvas", () => {
    const ctx = makeCtx();
    const adapter = new UIBridgeAdapter();
    bridge.emit(EVENTS.ACTION_REGISTER_CITY_MAP, { canvas: makeCanvas(ctx) });

    adapter.drawCityMap(
      { x: 640, y: 620 },
      [{ x: 840, y: 600, active: true, isDead: false }],
      CITY_WORLD,
      [{ x: 700, y: 640, container: { active: true } }]
    );

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });

  it("does nothing before the city map canvas is bound", () => {
    const adapter = new UIBridgeAdapter();
    expect(() =>
      adapter.drawCityMap({ x: 0, y: 0 }, [], CITY_WORLD)
    ).not.toThrow();
  });
});
