import { describe, it, expect, vi } from "vitest";
import { playSkillCastVfx } from "./skillVfx.js";
import { toIso } from "./isoProjection.js";

const makeSprite = () => {
  const sprite = {
    setOrigin: vi.fn(() => sprite),
    setDepth: vi.fn(() => sprite),
    setScale: vi.fn(() => sprite),
    setStrokeStyle: vi.fn(() => sprite),
    play: vi.fn(() => sprite),
    once: vi.fn(() => sprite),
    destroy: vi.fn()
  };
  return sprite;
};

const makeScene = ({ frameTotal = 5 } = {}) => {
  const animConfigs = [];
  const tweenConfig = { value: null };
  const scene = {
    cameras: { main: { width: 5700, height: 3200, zoom: 1 } },
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
        animConfigs.push(config);
      }
    },
    tweens: {
      add: (config) => {
        tweenConfig.value = config;
      }
    },
    add: { sprite: () => makeSprite() }
  };
  return { scene, animConfigs, tweenConfig };
};

const makePlayer = () => ({
  sprite: {},
  x: 100,
  y: 100,
  facingDirection: 2,
  visual: { scaleX: 1 }
});

describe("playSkillCastVfx sprite playback", () => {
  it("splits the sheet into looping travel frames and a one-shot impact", () => {
    const { scene, animConfigs } = makeScene({ frameTotal: 5 });
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(
      scene,
      makePlayer(),
      { range: 6000, radius: 0, vfx: { sprite: "palm", fps: 12 } },
      { x: 140, y: 100 }
    );

    expect(animConfigs).toHaveLength(2);
    expect(animConfigs[0]).toMatchObject({ repeat: -1, yoyo: true, frameRate: 8 });
    expect(animConfigs[0].frames).toHaveLength(2);
    expect(animConfigs[1]).toMatchObject({ repeat: 0, frameRate: 12 });
    expect(animConfigs[1].frames).toHaveLength(2);
    expect(sprite.play).toHaveBeenCalledWith("palm-travel");
  });

  it("flies to the target, then plays the impact and destroys the sprite", () => {
    const { scene, tweenConfig } = makeScene();
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(
      scene,
      makePlayer(),
      { range: 6000, radius: 0, vfx: { sprite: "palm", fps: 12 } },
      { x: 140, y: 100 }
    );

    const end = toIso(140, 100);
    expect(tweenConfig.value.x).toBe(end.x);
    expect(tweenConfig.value.y).toBe(end.y - 26);
    expect(tweenConfig.value.duration).toBe(220);
    expect(tweenConfig.value.ease).toBe("Quad.easeOut");

    tweenConfig.value.onComplete();
    expect(sprite.play).toHaveBeenCalledWith("palm-impact");
    expect(sprite.once).toHaveBeenCalledWith("animationcomplete", expect.any(Function));
    sprite.once.mock.calls[0][1]();
    expect(sprite.destroy).toHaveBeenCalled();
  });

  it("flies to the camera edge when the cast has no target", () => {
    const { scene, tweenConfig } = makeScene();
    const player = makePlayer();
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(scene, player, { range: 6000, radius: 0, vfx: { sprite: "palm" } }, null);

    const end = toIso(player.x + 2850, player.y);
    expect(tweenConfig.value.x).toBe(end.x);
    expect(tweenConfig.value.y).toBe(end.y - 26);
    expect(tweenConfig.value.duration).toBe(950);
  });

  it("uses the camera worldView when it is available", () => {
    const { scene, tweenConfig } = makeScene();
    scene.cameras.main.worldView = { left: 0, top: 0, right: 1000, bottom: 600, width: 1000 };
    scene.add.sprite = () => makeSprite();

    playSkillCastVfx(scene, makePlayer(), { range: 6000, radius: 0, vfx: { sprite: "palm" } }, null);

    const end = toIso(1000, 100);
    expect(tweenConfig.value.x).toBe(end.x);
    expect(tweenConfig.value.y).toBe(end.y - 26);
  });

  it("keeps the palm's visual size independent of a long travel range", () => {
    const { scene } = makeScene();
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(scene, makePlayer(), { range: 6000, radius: 0, vfx: { sprite: "palm" } }, null);

    expect(sprite.setScale).toHaveBeenCalledWith((90 * 1.8) / 256);
  });

  it("plays stationary sprite animation at caster position for self skills", () => {
    const { scene, animConfigs, tweenConfig } = makeScene({ frameTotal: 5 });
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;
    const player = makePlayer();

    playSkillCastVfx(
      scene,
      player,
      { target: "self", vfx: { sprite: "vfx-la-han-tran", fps: 8 } },
      null
    );

    expect(animConfigs).toHaveLength(1);
    expect(animConfigs[0]).toMatchObject({
      key: "vfx-la-han-tran-play",
      repeat: 0,
      frameRate: 8
    });
    expect(animConfigs[0].frames).toHaveLength(4);
    expect(sprite.play).toHaveBeenCalledWith("vfx-la-han-tran-play");
    expect(tweenConfig.value).toBeNull();
    expect(sprite.once).toHaveBeenCalledWith("animationcomplete", expect.any(Function));
    sprite.once.mock.calls[0][1]();
    expect(sprite.destroy).toHaveBeenCalled();
  });

  it("bypasses one-shot sprite creation for formation type skills and renders cast burst", () => {
    const { scene } = makeScene({ frameTotal: 5 });
    const sprite = makeSprite();
    scene.add.sprite = vi.fn(() => sprite);
    const circle = makeSprite();
    scene.add.circle = vi.fn(() => circle);
    const player = makePlayer();

    playSkillCastVfx(
      scene,
      player,
      { target: "self", vfx: { sprite: "vfx-la-han-tran", type: "formation", cast: "shockwave" } },
      null
    );

    // Sprite is not created in world space for formation type (handled by player.showFormation)
    expect(scene.add.sprite).not.toHaveBeenCalled();
    // Baseline circle pulse and shockwave circle were created
    expect(scene.add.circle).toHaveBeenCalled();
  });
});
