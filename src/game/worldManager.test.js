import { describe, expect, it } from "vitest";

import { WorldManager } from "./worldManager.js";

/**
 * Minimal Phaser stand-in. The renderer only needs `add.graphics`,
 * `add.tileSprite` and `make.graphics`; everything the painted path touches is a
 * chainable call, so the stub records what was created and returns itself.
 */
const createSceneStub = () => {
  const created = [];

  const chainable = (type, init = {}) => {
    const obj = { type, ...init };

    // Fluent setters and Graphics drawing calls all return the object itself.
    const fluent = [
      "setDepth",
      "setAlpha",
      "setTint",
      "setRotation",
      "setTileScale",
      "setVisible",
      "fillStyle",
      "fillRect",
      "fillEllipse",
      "lineStyle",
      "strokeRect",
      "strokeEllipse",
      "lineBetween"
    ];
    fluent.forEach((name) => {
      obj[name] = () => obj;
    });

    obj.setMask = (mask) => {
      obj.mask = mask;
      return obj;
    };
    obj.destroy = () => {
      obj.destroyed = true;
    };

    created.push(obj);
    return obj;
  };

  return {
    created,
    scene: {
      add: {
        graphics: () => chainable("graphics"),
        tileSprite: (_x, _y, width, height, key) =>
          chainable("tileSprite", { width, height, key })
      },
      make: {
        graphics: () => Object.assign(chainable("mask"), {
          createGeometryMask: () => ({ isMask: true })
        })
      }
    }
  };
};

/** @param {object} street */
const managerFor = (street) => {
  const { scene, created } = createSceneStub();
  const manager = new WorldManager(scene);
  manager.map = { ground: { streets: [street] } };
  return { manager, created };
};

const ofType = (created, type) => created.filter((obj) => obj.type === type);

describe("WorldManager street rendering", () => {
  it("paints a fill street as earth, with no paving sprite or kerbs", () => {
    const { manager, created } = managerFor({ x: 0, y: 0, w: 800, d: 200, fill: 0x6f6046 });

    manager.drawStreets();

    expect(ofType(created, "tileSprite")).toHaveLength(0);
    // One graphics object carries the band *and* its ragged edges.
    expect(ofType(created, "graphics")).toHaveLength(1);
  });

  it("lays a textured street with a mask, wear and kerbs", () => {
    const { manager, created } = managerFor({ x: 0, y: 0, w: 800, d: 200, tileKey: "ground-walkway" });

    manager.drawStreets();

    const [paving] = ofType(created, "tileSprite");
    expect(paving.key).toBe("ground-walkway");
    expect(paving.mask).toBeTruthy();
    // Wear pass plus the kerb drawing.
    expect(ofType(created, "graphics")).toHaveLength(2);
  });

  it("lays a vertical textured street with vertical kerbs", () => {
    const { manager, created } = managerFor({ x: 0, y: 0, w: 200, d: 800, tileKey: "ground-walkway" });

    manager.drawStreets();

    const [paving] = ofType(created, "tileSprite");
    expect(paving.key).toBe("ground-walkway");
    expect(ofType(created, "graphics")).toHaveLength(2);
  });

  it("skips a textured street's kerbs when the map asks for a track", () => {
    const { manager, created } = managerFor({
      x: 0,
      y: 0,
      w: 800,
      d: 200,
      tileKey: "ground-walkway",
      kerb: false
    });

    manager.drawStreets();

    // Only the wear pass remains.
    expect(ofType(created, "graphics")).toHaveLength(1);
  });

  it("draws nothing when the map has no streets", () => {
    const { scene, created } = createSceneStub();
    const manager = new WorldManager(scene);
    manager.map = { ground: {} };

    manager.drawStreets();

    expect(created).toHaveLength(0);
  });
});
