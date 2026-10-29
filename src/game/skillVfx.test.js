import { describe, it, expect, vi } from "vitest";
import { playSkillCastVfx } from "./skillVfx.js";
import { toIso } from "./isoProjection.js";

const makeSprite = () => {
  const sprite = {
    setOrigin: vi.fn(() => sprite),
    setDepth: vi.fn(() => sprite),
    setScale: vi.fn(() => sprite),
    setRotation: vi.fn(() => sprite),
    setStrokeStyle: vi.fn(() => sprite),
    play: vi.fn(() => sprite),
    once: vi.fn(() => sprite),
    setFrame: vi.fn(() => sprite),
    destroy: vi.fn()
  };
  return sprite;
};

const makeScene = ({ frameTotal = 5 } = {}) => {
  const animConfigs = [];
  const tweenConfigs = [];
  const tweenConfig = { value: null };
  const timers = [];
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
        tweenConfigs.push(config);
      }
    },
    time: {
      delayedCall: (ms, callback) => {
        timers.push({ ms, callback });
      }
    },
    add: {
      sprite: () => makeSprite(),
      circle: () => makeSprite(),
      polygon: () => makeSprite()
    }
  };
  return { scene, animConfigs, tweenConfig, tweenConfigs, timers };
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

  it("flies to the aimed point when the cast has no target", () => {
    const { scene, tweenConfig } = makeScene();
    scene.add.sprite = () => makeSprite();

    playSkillCastVfx(
      scene,
      makePlayer(),
      { range: 6000, radius: 0, vfx: { sprite: "palm" } },
      null,
      { x: 400, y: 100 }
    );

    const end = toIso(400, 100);
    expect(tweenConfig.value.x).toBe(end.x);
    expect(tweenConfig.value.y).toBe(end.y - 26);
  });

  it("clamps a far aim point to the skill range", () => {
    const { scene, tweenConfig } = makeScene();
    scene.add.sprite = () => makeSprite();

    playSkillCastVfx(
      scene,
      makePlayer(),
      { range: 300, radius: 0, vfx: { sprite: "palm" } },
      null,
      { x: 1000, y: 100 }
    );

    const end = toIso(400, 100);
    expect(tweenConfig.value.x).toBe(end.x);
    expect(tweenConfig.value.y).toBe(end.y - 26);
  });

  it("falls back to the facing edge when the aim point sits on the hero", () => {
    const { scene, tweenConfig } = makeScene();
    scene.add.sprite = () => makeSprite();
    const player = makePlayer();

    playSkillCastVfx(
      scene,
      player,
      { range: 6000, radius: 0, vfx: { sprite: "palm" } },
      null,
      { x: player.x, y: player.y }
    );

    const end = toIso(player.x + 2850, player.y);
    expect(tweenConfig.value.x).toBe(end.x);
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

  it("plays cast frames at the hero, then drops the palm onto the strike area", () => {
    const { scene, animConfigs, tweenConfigs, timers } = makeScene({ frameTotal: 5 });
    const castSprite = makeSprite();
    const impactSprite = makeSprite();
    scene.add.sprite = vi
      .fn()
      .mockReturnValueOnce(castSprite)
      .mockReturnValueOnce(impactSprite);
    const player = makePlayer();

    playSkillCastVfx(
      scene,
      player,
      {
        range: 0,
        radius: 140,
        vfx: { sprite: "palm", type: "slam", size: 260, impactScale: 1.4, fps: 12 }
      },
      { x: 140, y: 100 }
    );

    // Frames 0-1 are the cast gesture at the hero only.
    expect(animConfigs).toHaveLength(1);
    expect(animConfigs[0]).toMatchObject({ key: "palm-slam-cast", repeat: 0, frameRate: 12 });
    expect(animConfigs[0].frames).toHaveLength(2);
    expect(castSprite.play).toHaveBeenCalledWith("palm-slam-cast");
    expect(castSprite.setScale).toHaveBeenCalledWith(((260 * 1.8) / 256) * 0.4);
    expect(scene.add.sprite).toHaveBeenCalledTimes(1);

    // The impact starts after the cast gesture.
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBeCloseTo((2 / 12) * 1000);
    timers[0].callback();

    expect(scene.add.sprite).toHaveBeenCalledTimes(2);
    expect(impactSprite.setFrame).toHaveBeenCalledWith(2);
    expect(impactSprite.setOrigin).toHaveBeenCalledWith(0.5, 0.9);

    const end = toIso(140, 100);
    const [x, y, key] = scene.add.sprite.mock.calls[1];
    expect(key).toBe("palm");
    expect(x).toBe(end.x);
    expect(y).toBeLessThan(end.y - 26);

    // Frame 2 descends, frame 3 is the ground impact, then the sprite fades.
    const drop = tweenConfigs[0];
    expect(drop.targets).toBe(impactSprite);
    expect(drop).toMatchObject({ duration: 280, ease: "Quad.easeIn" });
    expect(drop.y).toBe(end.y - 26);
    drop.onComplete();
    expect(impactSprite.setFrame).toHaveBeenLastCalledWith(3);

    const baseScale = (260 * 1.8) / 256;
    const impactScale = baseScale * 1.4;
    expect(impactSprite.setScale).toHaveBeenLastCalledWith(impactScale * 0.85);

    // The landing frame blooms out to cover the AoE, then fades.
    const bloom = tweenConfigs[1];
    expect(bloom).toMatchObject({ targets: impactSprite, scale: impactScale, duration: 140 });
    const fade = tweenConfigs[2];
    expect(fade).toMatchObject({ targets: impactSprite, alpha: 0, delay: 140, duration: 240 });
    fade.onComplete();
    expect(impactSprite.destroy).toHaveBeenCalled();
  });
});

describe("playSkillCastVfx travelling sprite sheet", () => {
  const travelSheet = () => ({
    range: 840,
    splash: { radius: 170, mult: 0.6, maxTargets: 4 },
    vfx: {
      sprite: "vfx-test-sheet",
      travelFrames: 1,
      impact: null,
      rotateToTarget: true,
      impactScale: 1.8,
      color: 0x9be8ff,
      fps: 12
    }
  });

  it("loops only the travel frame and keeps the rest for the impact", () => {
    const { scene, animConfigs } = makeScene({ frameTotal: 5 });
    scene.add.sprite = () => makeSprite();

    playSkillCastVfx(scene, makePlayer(), travelSheet(), { x: 900, y: 100 });

    expect(animConfigs).toHaveLength(2);
    expect(animConfigs[0].frames).toHaveLength(1);
    expect(animConfigs[0]).toMatchObject({ repeat: -1, yoyo: false, frameRate: 8 });
    expect(animConfigs[1].frames).toHaveLength(3);
    expect(animConfigs[1]).toMatchObject({ repeat: 0, frameRate: 12 });
  });

  it("turns the blade toward its target", () => {
    const { scene } = makeScene();
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(scene, makePlayer(), travelSheet(), { x: 100, y: 200 });

    expect(sprite.setRotation).toHaveBeenCalledWith(Math.PI / 2);
  });

  it("leaves the art untouched when rotateToTarget is off", () => {
    const { scene } = makeScene();
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(scene, makePlayer(), { range: 840, radius: 0, vfx: { sprite: "palm" } }, {
      x: 100,
      y: 200
    });

    expect(sprite.setRotation).not.toHaveBeenCalled();
  });

  it("blooms the burst to impactScale when it lands, then clears itself", () => {
    const { scene, tweenConfig } = makeScene();
    const sprite = makeSprite();
    scene.add.sprite = () => sprite;

    playSkillCastVfx(scene, makePlayer(), travelSheet(), { x: 900, y: 100 });

    const baseScale = (90 * 1.8) / 256;
    tweenConfig.value.onComplete();

    expect(sprite.play).toHaveBeenLastCalledWith("vfx-test-sheet-impact");
    expect(sprite.setScale).toHaveBeenLastCalledWith(baseScale * 1.8);
    sprite.once.mock.calls[0][1]();
    expect(sprite.destroy).toHaveBeenCalled();
  });
});
