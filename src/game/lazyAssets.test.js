import { describe, expect, it } from "vitest";
import {
  OVERHEAD_IMAGES,
  VFX_SPRITES,
  ensureEquipmentTexture,
  ensureHeroBodyTexture,
  ensureOverheadTexture,
  ensureWeaponAttackTexture,
  ensureWeaponBodyTexture,
  ensureWeaponVfx,
  ensureSpritesheet,
  ensureVfxTexture
} from "./lazyAssets.js";

/**
 * Minimal scene stub: records loader calls and reports the given textures as
 * already loaded.
 * @param {{ loaded?: string[], hasLoader?: boolean }} [opts]
 */
const makeScene = ({ loaded = [], hasLoader = true } = {}) => {
  const calls = [];
  const scene = { calls, textures: { exists: (key) => loaded.includes(key) } };
  if (hasLoader) {
    scene.load = {
      spritesheet: (...args) => calls.push(["spritesheet", ...args]),
      image: (...args) => calls.push(["image", ...args]),
      start: () => calls.push(["start"])
    };
  }
  return scene;
};

describe("ensureSpritesheet", () => {
  it("reports true and touches no loader when the texture already exists", () => {
    const scene = makeScene({ loaded: ["palm"] });

    expect(ensureSpritesheet(scene, "palm", { url: "/palm.png", frameWidth: 8, frameHeight: 8 })).toBe(true);
    expect(scene.calls).toEqual([]);
  });

  it("queues the sheet and starts the loader when missing", () => {
    const scene = makeScene();

    const ready = ensureSpritesheet(scene, "palm", {
      url: "/palm.png",
      frameWidth: 64,
      frameHeight: 32
    });

    expect(ready).toBe(false);
    expect(scene.calls).toEqual([
      ["spritesheet", "palm", "/palm.png", { frameWidth: 64, frameHeight: 32 }],
      ["start"]
    ]);
  });

  it("degrades to false without a loader (unit-test scenes, headless)", () => {
    const scene = makeScene({ hasLoader: false });

    expect(ensureSpritesheet(scene, "palm", { url: "/palm.png", frameWidth: 1, frameHeight: 1 })).toBe(false);
    expect(scene.calls).toEqual([]);
  });

  it("ignores an unknown definition", () => {
    const scene = makeScene();

    expect(ensureSpritesheet(scene, "unknown", undefined)).toBe(false);
    expect(scene.calls).toEqual([]);
  });
});

describe("ensureVfxTexture", () => {
  it("queues a catalogued VFX sheet", () => {
    const scene = makeScene();

    expect(ensureVfxTexture(scene, "vfx-la-han-tran")).toBe(false);
    expect(scene.calls).toEqual([
      [
        "spritesheet",
        "vfx-la-han-tran",
        VFX_SPRITES["vfx-la-han-tran"].url,
        { frameWidth: 256, frameHeight: 256 }
      ],
      ["start"]
    ]);
  });

  it("is a no-op for an unknown VFX key", () => {
    const scene = makeScene();

    expect(ensureVfxTexture(scene, "vfx-missing")).toBe(false);
    expect(scene.calls).toEqual([]);
  });
});

describe("ensureOverheadTexture", () => {
  it("queues the overhead image when missing", () => {
    const scene = makeScene();

    expect(ensureOverheadTexture(scene, "buff-phat-an")).toBe(false);
    expect(scene.calls).toEqual([
      ["image", "buff-phat-an", OVERHEAD_IMAGES["buff-phat-an"]],
      ["start"]
    ]);
  });

  it("is a no-op for an unknown overhead key", () => {
    const scene = makeScene();

    expect(ensureOverheadTexture(scene, "buff-missing")).toBe(false);
    expect(scene.calls).toEqual([]);
  });
});

describe("ensureWeaponVfx", () => {
  it("queues only skills that carry a sprite, in a single loader batch", () => {
    const scene = makeScene();

    ensureWeaponVfx(scene, [
      { id: "no-vfx" },
      { id: "palm", vfx: { sprite: "vfx-dai-tu-di-chuong" } },
      { id: "ring", vfx: { sprite: "vfx-la-han-tran" } },
      { id: "ultimate", vfx: { sprite: "vfx-nhu-lai-than-chuong" } },
      { id: "sword", vfx: { sprite: "vfx-thieu-duong-kiem-phap" } },
      { id: "taichi", vfx: { sprite: "vfx-thai-cuc-kiem-phap" } },
      { id: "triad", vfx: { sprite: "vfx-tam-thanh-kiem-phap" } }
    ]);

    expect(scene.calls.filter(([name]) => name === "spritesheet").map((call) => call[1])).toEqual([
      "vfx-dai-tu-di-chuong",
      "vfx-la-han-tran",
      "vfx-nhu-lai-than-chuong",
      "vfx-thieu-duong-kiem-phap",
      "vfx-thai-cuc-kiem-phap",
      "vfx-tam-thanh-kiem-phap"
    ]);
    expect(scene.calls.filter(([name]) => name === "start")).toHaveLength(1);
  });

  it("queues an overhead buff image together with the weapon sheets", () => {
    const scene = makeScene();

    ensureWeaponVfx(scene, [{ id: "kim-cang", vfx: { type: "overhead", overhead: "buff-phat-an" } }]);

    expect(scene.calls).toEqual([
      ["image", "buff-phat-an", OVERHEAD_IMAGES["buff-phat-an"]],
      ["start"]
    ]);
  });

  it("returns true when every weapon sheet is already loaded", () => {
    const scene = makeScene({ loaded: ["vfx-la-han-tran"] });

    expect(
      ensureWeaponVfx(scene, [{ vfx: { sprite: "vfx-la-han-tran" } }, { id: "no-vfx" }])
    ).toBe(true);
    expect(scene.calls).toEqual([]);
  });

  it("queues nothing for a kit without sprite VFX", () => {
    const scene = makeScene();

    expect(ensureWeaponVfx(scene, [{ id: "plain" }, {}])).toBe(true);
    expect(scene.calls).toEqual([]);
  });
});

describe("ensureHeroBodyTexture", () => {
  it("queues the sheet for the requested gender with the rig frame size", () => {
    const scene = makeScene();

    expect(ensureHeroBodyTexture(scene, "female")).toBe(false);
    expect(scene.calls).toEqual([
      ["spritesheet", "hero-body-female", expect.stringContaining("/hero-body-female.png"), {
        frameWidth: 128,
        frameHeight: 160
      }],
      ["start"]
    ]);
  });

  it("normalises unknown genders to the male sheet", () => {
    const scene = makeScene({ loaded: ["hero-body-male"] });

    expect(ensureHeroBodyTexture(scene, "nope")).toBe(true);
    expect(scene.calls).toEqual([]);
  });
});

describe("ensureWeaponBodyTexture", () => {
  it("queues the sword sheet for a hero holding a sword", () => {
    const scene = makeScene();

    expect(ensureWeaponBodyTexture(scene, "male", "kiem")).toBe(false);
    expect(scene.calls).toEqual([
      [
        "spritesheet",
        "hero-body-male-sword",
        expect.stringContaining("/hero-body-male-sword.png"),
        { frameWidth: 148, frameHeight: 160 }
      ],
      ["start"]
    ]);

    const femaleScene = makeScene();

    expect(ensureWeaponBodyTexture(femaleScene, "female", "kiem")).toBe(false);
    expect(femaleScene.calls).toEqual([
      [
        "spritesheet",
        "hero-body-female-sword",
        expect.stringContaining("/hero-body-female-sword.png"),
        { frameWidth: 150, frameHeight: 160 }
      ],
      ["start"]
    ]);
  });

  it("queues nothing for weapons without their own sheet", () => {
    const scene = makeScene();

    expect(ensureWeaponBodyTexture(scene, "male", "dao")).toBe(false);
    expect(ensureWeaponBodyTexture(scene, "female", "dao")).toBe(false);
    expect(ensureWeaponBodyTexture(scene, "male", null)).toBe(false);
    expect(scene.calls).toEqual([]);
  });

  it("returns true when the sword sheet is already loaded", () => {
    const scene = makeScene({ loaded: ["hero-body-male-sword"] });

    expect(ensureWeaponBodyTexture(scene, "male", "kiem")).toBe(true);
    expect(scene.calls).toEqual([]);
  });
});

describe("ensureWeaponAttackTexture", () => {
  it("queues the swing sheet with its own frame size", () => {
    const scene = makeScene();

    expect(ensureWeaponAttackTexture(scene, "male", "kiem")).toBe(false);
    expect(scene.calls).toEqual([
      [
        "spritesheet",
        "hero-body-male-sword-attack",
        expect.stringContaining("/hero-body-male-sword-attack.png"),
        { frameWidth: 192, frameHeight: 160 }
      ],
      ["start"]
    ]);
  });

  it("queues the female swing sheet too", () => {
    const scene = makeScene();

    expect(ensureWeaponAttackTexture(scene, "female", "kiem")).toBe(false);
    expect(scene.calls).toEqual([
      [
        "spritesheet",
        "hero-body-female-sword-attack",
        expect.stringContaining("/hero-body-female-sword-attack.png"),
        { frameWidth: 192, frameHeight: 160 }
      ],
      ["start"]
    ]);
  });

  it("queues nothing for looks without swing art", () => {
    const scene = makeScene();

    expect(ensureWeaponAttackTexture(scene, "female", "dao")).toBe(false);
    expect(ensureWeaponAttackTexture(scene, "male", "dao")).toBe(false);
    expect(scene.calls).toEqual([]);
  });
});

describe("ensureEquipmentTexture", () => {
  it("queues the equipment spritesheet when texture is not loaded", () => {
    const scene = makeScene();

    expect(ensureEquipmentTexture(scene, "armor", "ao-lang-khach", "male")).toBe(false);
    expect(scene.calls).toEqual([
      [
        "spritesheet",
        "hero-armor-lang-khach-male",
        expect.stringContaining("/hero-armor-lang-khach-male.png"),
        { frameWidth: 128, frameHeight: 160 }
      ],
      ["start"]
    ]);
  });

  it("returns true immediately when the equipment texture is already loaded", () => {
    const scene = makeScene({ loaded: ["hero-armor-lang-khach-male"] });

    expect(ensureEquipmentTexture(scene, "armor", "ao-lang-khach", "male")).toBe(true);
    expect(scene.calls).toEqual([]);
  });

  it("returns false for unknown equipment items without queuing", () => {
    const scene = makeScene();

    expect(ensureEquipmentTexture(scene, "armor", "unknown-item", "male")).toBe(false);
    expect(scene.calls).toEqual([]);
  });

  it("handles female variants correctly", () => {
    const scene = makeScene();

    expect(ensureEquipmentTexture(scene, "helmet", "non-lang-khach", "female")).toBe(false);
    expect(scene.calls).toEqual([
      [
        "spritesheet",
        "hero-hat-non-mang",
        expect.stringContaining("/hero-hat-non-mang.png"),
        { frameWidth: 128, frameHeight: 160 }
      ],
      ["start"]
    ]);
  });
});
