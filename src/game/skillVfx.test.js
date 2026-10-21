import { describe, it, expect, vi } from "vitest";
import { playSkillCastVfx } from "./skillVfx.js";

const makeSprite = () => {
  const sprite = {
    setOrigin: vi.fn(() => sprite),
    setDepth: vi.fn(() => sprite),
    setScale: vi.fn(() => sprite),
    play: vi.fn(() => sprite),
    once: vi.fn(() => sprite),
    destroy: vi.fn()
  };
  return sprite;
};

const makeScene = ({ frameTotal = 5 } = {}) => {
  const animConfig = { value: null };
  const scene = {
    textures: {
      exists: () => true,
      get: () => ({
        frameTotal,
        get: () => ({ width: 256 })
      })
    },
    anims: {
      exists: () => false,
      generateFrameNumbers: (key, { start, end }) =>
        Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => ({
          key,
          frame: start + index
        })),
      create: (config) => {
        animConfig.value = config;
      }
    },
    add: { sprite: () => makeSprite() }
  };
  return { scene, animConfig };
};

describe("playSkillCastVfx sprite playback", () => {
  it("plays every frame in the sheet at the requested fps", () => {
    const { scene, animConfig } = makeScene({ frameTotal: 5 });
    const player = { sprite: {}, x: 100, y: 100, visual: { scaleX: 1 } };
    const skill = { radius: 110, vfx: { sprite: "palm", fps: 12 } };
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(scene, player, skill, { x: 140, y: 100 });

    expect(animConfig.value.frames).toHaveLength(4);
    expect(animConfig.value.frameRate).toBe(12);
    expect(animConfig.value.repeat).toBe(0);
    expect(sprite.play).toHaveBeenCalledWith("palm-play");
  });

  it("scales the sprite from the texture frame size to the skill radius", () => {
    const { scene } = makeScene();
    const player = { sprite: {}, x: 100, y: 100, visual: { scaleX: 1 } };
    const skill = { radius: 110, vfx: { sprite: "palm" } };
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(scene, player, skill, null);

    expect(sprite.setScale).toHaveBeenCalledWith((110 * 1.8) / 256);
    expect(sprite.play).toHaveBeenCalledWith("palm-play");
    expect(sprite.once).toHaveBeenCalledWith("animationcomplete", expect.any(Function));
    sprite.once.mock.calls[0][1]();
    expect(sprite.destroy).toHaveBeenCalled();
  });
});
