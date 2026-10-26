import { describe, expect, it, vi } from "vitest";
import { OVERHEAD_SEAL_OFFSET_Y, OVERHEAD_SEAL_SCALE, OverheadSeal } from "./overheadSeal.js";

const makeScene = ({ loaded = new Set() } = {}) => {
  const sprite = {
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setTexture: vi.fn().mockReturnThis(),
    destroy: vi.fn()
  };
  const calls = [];
  const scene = {
    textures: { exists: vi.fn((key) => loaded.has(key)) },
    load: {
      image: vi.fn((...args) => calls.push(["image", ...args])),
      start: vi.fn(() => calls.push(["start"]))
    },
    add: { sprite: vi.fn(() => sprite) }
  };
  return { scene, sprite, calls };
};

const makeContainer = () => ({ add: vi.fn() });

describe("OverheadSeal", () => {
  it("retries until the texture loads, then shows and follows the character bob", () => {
    const { scene, sprite, calls } = makeScene();
    const container = makeContainer();
    const seal = new OverheadSeal(scene, container);

    seal.show("buff-phat-an");
    expect(scene.add.sprite).not.toHaveBeenCalled();
    expect(calls).toEqual([["image", "buff-phat-an", "/skills/kim_cang_bat_hoai.png"], ["start"]]);

    scene.textures.exists.mockReturnValue(true);
    seal.update(4);

    expect(scene.add.sprite).toHaveBeenCalledWith(0, OVERHEAD_SEAL_OFFSET_Y, "buff-phat-an");
    expect(sprite.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(container.add).toHaveBeenCalledWith(sprite);
    expect(sprite.setScale).toHaveBeenCalledWith(OVERHEAD_SEAL_SCALE);
    expect(sprite.setVisible).toHaveBeenCalledWith(true);
    expect(sprite.setPosition).toHaveBeenLastCalledWith(0, OVERHEAD_SEAL_OFFSET_Y + 1.4);
  });

  it("replaces the texture, hides without destroying, and cleans up once", () => {
    const { scene } = makeScene({ loaded: new Set(["buff-phat-an", "buff-other"]) });
    const seal = new OverheadSeal(scene, makeContainer());

    seal.show("buff-phat-an", 0.08, -90);
    const sprite = seal.sprite;
    expect(sprite.setScale).toHaveBeenCalledWith(0.08);
    expect(sprite.setPosition).toHaveBeenLastCalledWith(0, -90);

    seal.show("buff-other");
    expect(sprite.setTexture).toHaveBeenCalledWith("buff-other");

    seal.hide();
    expect(sprite.setVisible).toHaveBeenLastCalledWith(false);
    expect(sprite.destroy).not.toHaveBeenCalled();

    seal.destroy();
    expect(sprite.destroy).toHaveBeenCalledTimes(1);
    expect(seal.sprite).toBeNull();
  });
});
