import { describe, expect, it, vi } from "vitest";
import { TARGET_RING_COLORS, TargetRing } from "./targetRing.js";

const chainable = (methods) => {
  const obj = {};
  methods.forEach((method) => {
    obj[method] = vi.fn(() => obj);
  });
  return obj;
};

const makeScene = () => {
  const container = chainable([
    "setVisible",
    "setDepth",
    "setPosition",
    "add",
    "destroy"
  ]);
  const shapes = [];
  const makeShape = () => {
    const shape = chainable(["setFillStyle", "setStrokeStyle", "destroy"]);
    shapes.push(shape);
    return shape;
  };
  const tweens = { add: vi.fn(() => ({ stop: vi.fn() })) };

  return {
    container,
    shapes,
    tweens,
    scene: {
      add: {
        container: vi.fn(() => container),
        ellipse: vi.fn(() => makeShape())
      },
      tweens
    }
  };
};

describe("TargetRing", () => {
  it("creates its shapes lazily on the first show", () => {
    const { scene } = makeScene();
    const ring = new TargetRing(scene);

    expect(scene.add.container).not.toHaveBeenCalled();

    ring.show(120, 240, "monster");

    expect(scene.add.container).toHaveBeenCalledTimes(1);
    expect(scene.add.ellipse).toHaveBeenCalledTimes(3);
  });

  it("sits under the target's feet and behind the character", () => {
    const { scene, container } = makeScene();
    const ring = new TargetRing(scene);

    ring.show(120, 240, "monster");

    expect(container.setPosition).toHaveBeenCalledWith(120, 240);
    expect(container.setDepth).toHaveBeenCalledWith(239);
    expect(container.setVisible).toHaveBeenCalledWith(true);
  });

  it("follows the target without rebuilding the shapes", () => {
    const { scene, container } = makeScene();
    const ring = new TargetRing(scene);

    ring.show(120, 240, "monster");
    ring.show(160, 300, "monster");

    expect(scene.add.container).toHaveBeenCalledTimes(1);
    expect(container.setPosition).toHaveBeenLastCalledWith(160, 300);
  });

  it("recolors once when the target kind changes", () => {
    const { scene, shapes } = makeScene();
    const ring = new TargetRing(scene);

    ring.show(120, 240, "monster");
    const [, ringShape] = shapes;
    ringShape.setStrokeStyle.mockClear();

    ring.show(120, 240, "monster");
    expect(ringShape.setStrokeStyle).not.toHaveBeenCalled();

    ring.show(120, 240, "player");
    expect(ringShape.setStrokeStyle).toHaveBeenCalledWith(
      3,
      TARGET_RING_COLORS.player,
      0.95
    );
  });

  it("hides and destroys cleanly", () => {
    const { scene, container } = makeScene();
    const ring = new TargetRing(scene);
    ring.show(10, 20);

    ring.hide();
    expect(container.setVisible).toHaveBeenLastCalledWith(false);

    ring.destroy();
    expect(container.destroy).toHaveBeenCalledTimes(1);
    // A second teardown must stay harmless.
    expect(() => ring.destroy()).not.toThrow();
  });

  it("no-ops when the scene cannot add objects", () => {
    const ring = new TargetRing({});

    expect(() => ring.show(1, 2)).not.toThrow();
    expect(() => ring.hide()).not.toThrow();
    expect(() => ring.destroy()).not.toThrow();
  });
});
