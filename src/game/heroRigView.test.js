import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HeroRigView } from "./heroRigView.js";
import { BODY_BAKED_SLOTS, HERO_BODY } from "./heroBody.js";

/** Minimal Phaser scene stub: enough shape factories for the rig view. */
function makeShape() {
  return {
    x: 0,
    y: 0,
    setOrigin() {
      return this;
    },
    setStrokeStyle() {
      return this;
    },
    setLineWidth() {
      return this;
    }
  };
}

function makeScene() {
  const container = {
    x: 0,
    y: 0,
    children: [],
    add(o) {
      container.children.push(o);
    },
    removeAll() {},
    destroy() {}
  };
  return {
    add: {
      container: (x = 0, y = 0) => Object.assign(container, { x, y }),
      polygon: () => makeShape(),
      rectangle: (x, y) => Object.assign(makeShape(), { x, y }),
      ellipse: (x, y) => Object.assign(makeShape(), { x, y }),
      circle: (x, y) => Object.assign(makeShape(), { x, y }),
      line: () => makeShape()
    },
    _container: container
  };
}

function makeSpriteScene(availableTextures = ["hero-body-male", "hero-body-female"]) {
  const textureSet = new Set(availableTextures);
  const container = {
    x: 0,
    y: 0,
    children: [],
    add(o) {
      container.children.push(o);
    },
    removeAll() {
      container.children = [];
    },
    destroy() {
      container.children = [];
    }
  };
  const shape = () => ({
    x: 0,
    y: 0,
    setOrigin() {
      return this;
    },
    setStrokeStyle() {
      return this;
    },
    setLineWidth() {
      return this;
    }
  });
  return {
    add: {
      container: (x = 0, y = 0) => Object.assign(container, { x, y }),
      polygon: () => shape(),
      rectangle: (x, y) => Object.assign(shape(), { x, y }),
      ellipse: (x, y) => Object.assign(shape(), { x, y }),
      circle: (x, y) => Object.assign(shape(), { x, y }),
      line: () => shape(),
      sprite: (x, y, texture, frame) => ({
        x,
        y,
        texture,
        frame,
        origin: null,
        scale: 1,
        flipX: false,
        frameSets: 0,
        setOrigin(ox, oy) {
          this.origin = [ox, oy];
          return this;
        },
        setScale(scale) {
          this.scale = scale;
          return this;
        },
        setFlipX(flip) {
          this.flipX = flip;
          return this;
        },
        setFrame(frameIndex) {
          this.frame = frameIndex;
          this.frameSets += 1;
          return this;
        }
      })
    },
    textures: {
      exists: (key) => textureSet.has(key)
    },
    _textures: textureSet,
    _container: container
  };
}

describe("HeroRigView", () => {
  it("builds limb groups when the rig is set", () => {
    const view = new HeroRigView(makeScene(), { footOffsetY: 41 });
    expect(view.container.y).toBe(41);

    view.set(2, {}); // facing right: full side-on stride on the x axis
    expect(view.groups.legR.length).toBeGreaterThan(0);
    expect(view.groups.legL.length).toBeGreaterThan(0);
    expect(view.groups.armR.length).toBeGreaterThan(0);
  });

  it("swings opposite legs and returns to base at phase 0", () => {
    const view = new HeroRigView(makeScene());
    view.set(2, {});
    const legR = view.groups.legR[0];
    const legL = view.groups.legL[0];
    const base = legR.baseX;

    view.animate(1);
    expect(Math.abs(legR.obj.x - base)).toBeGreaterThan(1);
    // The two legs move to opposite sides of the base position.
    expect(Math.sign(legR.obj.x - base)).toBe(-Math.sign(legL.obj.x - legL.baseX));

    view.animate(0);
    expect(legR.obj.x).toBe(base);
  });

  it("does not rebuild when direction and equipment are unchanged", () => {
    const scene = makeScene();
    const view = new HeroRigView(scene);
    view.set(3, { helmet: "x" });
    const count = scene._container.children.length;
    view.set(3, { helmet: "x" });
    expect(scene._container.children.length).toBe(count);
  });

  it("rebuilds when the gender changes and remembers it for animation", () => {
    const scene = makeScene();
    const view = new HeroRigView(scene);
    view.set(2, {}, "male");
    const count = scene._container.children.length;
    view.set(2, {}, "female");
    expect(view.gender).toBe("female");
    expect(scene._container.children.length).not.toBe(count);
    expect(view.groups.legR.length).toBeGreaterThan(0);
  });
});

describe("HeroRigView baked body", () => {
  it("renders the gender sheet and starts on the direction's idle frame", () => {
    const scene = makeSpriteScene();
    const view = new HeroRigView(scene, { footOffsetY: 41 });

    view.set(2, {}, "male");

    expect(view.usingSprite).toBe(true);
    expect(view.bodySprite.texture).toBe("hero-body-male");
    expect(view.bodySprite.frame).toBe(8); // right row (2) * 4 columns
    expect(view.bodySprite.origin).toEqual([0.5, 1]);
    expect(view.bodySprite.y).toBeCloseTo(HERO_BODY.footOffsetY);
  });

  it("switches sheets with gender and frames with direction", () => {
    const scene = makeSpriteScene();
    const view = new HeroRigView(scene);

    view.set(2, {}, "male");
    view.set(6, {}, "female");

    expect(view.bodySprite.texture).toBe("hero-body-female");
    expect(view.bodySprite.frame).toBe(4); // left row (1) * 4 columns
  });

  it("does not flip the sprite; the sheet has a real left row", () => {
    const scene = makeSpriteScene();
    const view = new HeroRigView(scene);

    view.set(6, {}, "male");
    expect(view.bodySprite.flipX).toBe(false);
  });

  it("plays walk frames from the gait phase and returns to idle", () => {
    const scene = makeSpriteScene();
    const view = new HeroRigView(scene);
    view.set(2, {});

    view.animate(Math.PI / 4);
    expect(view.bodySprite.frameSets).toBe(0); // still in the first quarter
    view.animate(Math.PI / 2);
    expect(view.bodySprite.frame).toBe(9);
    expect(view.bodySprite.frameSets).toBe(1);

    view.animate(Math.PI * 2);
    expect(view.bodySprite.frame).toBe(8);
  });

  it("draws weapon overlays on the female sheet", () => {
    const scene = makeSpriteScene();
    const view = new HeroRigView(scene);

    view.set(2, { weapon: "dao-lang-khach" }, "female");

    expect(view.equipSprites).toEqual({});
    expect(scene._container.children.length).toBeGreaterThan(1);
  });

  it("skips the clothing slots baked into the male sheet", () => {
    const scene = makeSpriteScene([
      "hero-body-male",
      "hero-armor-lang-khach-male",
      "hero-pants-lang-khach-male",
      "hero-hat-non-truc"
    ]);
    const view = new HeroRigView(scene);

    view.set(2, { armor: "ao-lang-khach", pants: "quan-lang-khach", helmet: "non-truc" }, "male");

    expect(view.equipSprites).toEqual({});
    expect(scene._container.children).toHaveLength(1); // body sprite only
    expect(view.key).toContain("ao-lang-khach");
  });

  it("skips the clothing slots baked into the female sheet", () => {
    const scene = makeSpriteScene([
      "hero-body-female",
      "hero-armor-lang-khach-female",
      "hero-pants-lang-khach-male",
      "hero-hat-non-mang"
    ]);
    const view = new HeroRigView(scene);

    view.set(2, { armor: "ao-lang-khach", pants: "quan-lang-khach", helmet: "non-mang" }, "female");

    expect(view.equipSprites).toEqual({});
    expect(scene._container.children).toHaveLength(1); // body sprite only
    expect(view.key).toContain("ao-lang-khach");
  });

  it("keeps weapon and accessory overlays on the male sheet", () => {
    const scene = makeSpriteScene();
    const view = new HeroRigView(scene);

    view.set(0, { weapon: "dao-lang-khach", accessory: "ngoc-boi" }, "male");

    expect(view.equipSprites).toEqual({});
    expect(scene._container.children.length).toBeGreaterThan(1);
  });

  it("swaps to the sword sheet and drops the vector weapon", () => {
    const scene = makeSpriteScene(["hero-body-male", "hero-body-female", "hero-body-male-sword"]);
    const view = new HeroRigView(scene);

    view.set(2, { weapon: "kiem-lang-khach" }, "male");

    expect(view.bodySprite.texture).toBe("hero-body-male-sword");
    expect(scene._container.children).toHaveLength(1); // body sprite only
  });

  it("keeps the plain sheet for a non-sword weapon", () => {
    const scene = makeSpriteScene(["hero-body-male", "hero-body-male-sword"]);
    const view = new HeroRigView(scene);

    view.set(2, { weapon: "dao-lang-khach" }, "male");

    expect(view.bodySprite.texture).toBe("hero-body-male");
    expect(scene._container.children.length).toBeGreaterThan(1); // vector weapon drawn
  });

  it("falls back to the plain sheet while the sword sheet downloads", () => {
    const scene = makeSpriteScene(["hero-body-male"]);
    const queues = [];
    scene.load = {
      spritesheet: (...args) => queues.push(args),
      start: () => {},
      once: () => {}
    };
    const view = new HeroRigView(scene);

    view.set(0, { weapon: "kiem-lang-khach" }, "male");

    expect(view.bodySprite.texture).toBe("hero-body-male");
    expect(scene._container.children.length).toBeGreaterThan(1); // vector weapon drawn
    expect(queues.map(([key]) => key)).toEqual(["hero-body-male-sword"]);
    expect(view.pendingSheets.has("hero-body-male-sword")).toBe(true);
  });

  it("redraws with the sword sheet once the queued download lands", () => {
    const scene = makeSpriteScene(["hero-body-male"]);
    const listeners = new Map();
    scene.load = {
      spritesheet: () => {},
      start: () => {},
      once: (event, callback) => listeners.set(event, callback)
    };
    const view = new HeroRigView(scene);
    view.set(0, { weapon: "kiem-lang-khach" }, "male");
    expect(view.bodySprite.texture).toBe("hero-body-male");

    scene._textures.add("hero-body-male-sword");
    listeners.get("filecomplete-spritesheet-hero-body-male-sword")();

    expect(view.bodySprite.texture).toBe("hero-body-male-sword");
    expect(scene._container.children).toHaveLength(1); // blade is in the art now
    expect(view.pendingSheets.size).toBe(0);
  });

  it("listens for the sheet before starting the download", () => {
    const scene = makeSpriteScene(["hero-body-male"]);
    const events = [];
    scene.load = {
      spritesheet: (key) => events.push(`queue:${key}`),
      start: () => {},
      once: (event) => events.push(`once:${event}`)
    };
    const view = new HeroRigView(scene);

    view.set(0, { weapon: "kiem-lang-khach" }, "male");

    // A cached file can finish loading immediately, so the listener must exist
    // before the loader is kicked.
    expect(events).toEqual([
      "once:filecomplete-spritesheet-hero-body-male-sword",
      "queue:hero-body-male-sword"
    ]);
  });

  it("does not pin the sheet as pending when the scene has no loader", () => {
    const scene = makeSpriteScene(["hero-body-male"]);
    const view = new HeroRigView(scene);

    view.set(0, { weapon: "kiem-lang-khach" }, "male");

    expect(view.pendingSheets.size).toBe(0);
  });
});

describe("HeroRigView modular clothing overlays", () => {
  // Both shipped body sheets already paint the clothing, so the baked-slot
  // table is cleared for this suite to keep the optional overlay path covered.
  const baked = { ...BODY_BAKED_SLOTS };
  beforeEach(() => {
    BODY_BAKED_SLOTS.female = [];
  });
  afterEach(() => {
    Object.assign(BODY_BAKED_SLOTS, baked);
  });

  it("instantiates modular equipment sprites when matching textures exist", () => {
    const scene = makeSpriteScene([
      "hero-body-male",
      "hero-body-female",
      "hero-armor-lang-khach-female",
      "hero-hat-non-mang"
    ]);
    const view = new HeroRigView(scene);

    view.set(0, { armor: "ao-lang-khach", helmet: "non-mang" }, "female");

    expect(view.equipSprites.armor).toBeDefined();
    expect(view.equipSprites.armor.texture).toBe("hero-armor-lang-khach-female");
    expect(view.equipSprites.helmet).toBeDefined();
    expect(view.equipSprites.helmet.texture).toBe("hero-hat-non-mang");
    expect(view.equipSprites.armor.frame).toBe(0);
    expect(view.equipSprites.helmet.frame).toBe(0);
  });

  it("synchronizes animation frames across body and all modular equipment sprites", () => {
    const scene = makeSpriteScene([
      "hero-body-female",
      "hero-armor-lang-khach-female",
      "hero-hat-non-mang"
    ]);
    const view = new HeroRigView(scene);
    view.set(2, { armor: "ao-lang-khach", helmet: "non-mang" }, "female");

    expect(view.bodySprite.frame).toBe(8);
    expect(view.equipSprites.armor.frame).toBe(8);
    expect(view.equipSprites.helmet.frame).toBe(8);

    view.animate(Math.PI / 2);

    expect(view.bodySprite.frame).toBe(9);
    expect(view.equipSprites.armor.frame).toBe(9);
    expect(view.equipSprites.helmet.frame).toBe(9);
    expect(view.equipSprites.armor.frameSets).toBe(1);
    expect(view.equipSprites.helmet.frameSets).toBe(1);
  });

  it("falls back to vector shapes for slots lacking sprite textures while rendering sprites for supported slots", () => {
    const scene = makeSpriteScene([
      "hero-body-female",
      "hero-hat-non-mang"
      // armor sprite texture intentionally omitted
    ]);
    const view = new HeroRigView(scene);

    view.set(0, { armor: "ao-lang-khach", helmet: "non-mang" }, "female");

    expect(view.equipSprites.helmet).toBeDefined();
    expect(view.equipSprites.armor).toBeUndefined();
    // Container includes: bodySprite + vector primitives for armor + helmet sprite
    expect(scene._container.children.length).toBeGreaterThan(2);
  });

  it("cleans up equipment sprites on destroy and unequip", () => {
    const scene = makeSpriteScene([
      "hero-body-female",
      "hero-armor-lang-khach-female"
    ]);
    const view = new HeroRigView(scene);
    view.set(0, { armor: "ao-lang-khach" }, "female");
    expect(view.equipSprites.armor).toBeDefined();

    view.set(0, {}, "female");
    expect(view.equipSprites.armor).toBeUndefined();

    view.set(0, { armor: "ao-lang-khach" }, "female");
    view.destroy();
    expect(view.equipSprites).toEqual({});
    expect(view.bodySprite).toBeNull();
  });

  it("rebuilds equipment when independent pants slot changes", () => {
    const scene = makeSpriteScene([
      "hero-body-female",
      "hero-pants-lang-khach-male"
    ]);
    const view = new HeroRigView(scene);
    view.set(0, { pants: "quan-lang-khach" }, "female");
    expect(view.equipSprites.pants).toBeDefined();

    view.set(0, { pants: null }, "female");
    expect(view.equipSprites.pants).toBeUndefined();
  });
});
