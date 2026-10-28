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
    visible: true,
    setOrigin() {
      return this;
    },
    setStrokeStyle() {
      return this;
    },
    setLineWidth() {
      return this;
    },
    setVisible(next) {
      this.visible = next;
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
        },
        setTexture(nextTexture, nextFrame = 0) {
          this.texture = nextTexture;
          this.frame = nextFrame;
          this.textureSets = (this.textureSets ?? 0) + 1;
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
    // Both the sword pose and its swing sheet are queued up front.
    expect(queues.map(([key]) => key)).toEqual([
      "hero-body-male-sword",
      "hero-body-male-sword-attack"
    ]);
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
  });

  it("listens for each sheet before starting its download", () => {
    const scene = makeSpriteScene(["hero-body-male"]);
    const events = [];
    scene.load = {
      spritesheet: (key) => events.push(`queue:${key}`),
      start: () => {},
      once: (event) => events.push(`once:${event}`)
    };
    const view = new HeroRigView(scene);

    view.set(0, { weapon: "kiem-lang-khach" }, "male");

    // A cached file can finish loading immediately, so each listener must exist
    // before its loader is kicked.
    expect(events).toEqual([
      "once:filecomplete-spritesheet-hero-body-male-sword",
      "queue:hero-body-male-sword",
      "once:filecomplete-spritesheet-hero-body-male-sword-attack",
      "queue:hero-body-male-sword-attack"
    ]);
  });

  it("does not pin the sheet as pending when the scene has no loader", () => {
    const scene = makeSpriteScene(["hero-body-male"]);
    const view = new HeroRigView(scene);

    view.set(0, { weapon: "kiem-lang-khach" }, "male");

    expect(view.pendingSheets.size).toBe(0);
  });
});

/**
 * Phaser timer stub: records every timer and lets a test fire its callback, so a
 * frame-stepped animation can be walked without a running game loop.
 * @param {{ scene: object }} opts
 */
function attachTimerStub(scene) {
  const timers = [];
  scene.time = {
    addEvent: (config) => {
      const timer = {
        config,
        removed: false,
        remove() {
          this.removed = true;
        },
        tick(times = 1) {
          for (let i = 0; i < times; i += 1) config.callback();
        }
      };
      timers.push(timer);
      return timer;
    }
  };
  return timers;
}

describe("HeroRigView sword swing", () => {
  const swordScene = () =>
    makeSpriteScene(["hero-body-male", "hero-body-male-sword", "hero-body-male-sword-attack"]);

  it("plays the swing sheet and returns to the walk pose", () => {
    const scene = swordScene();
    const timers = attachTimerStub(scene);
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "kiem-lang-khach" }, "male"); // faces right (row 2)

    const played = view.attack("slash");

    expect(played).toBe(true);
    expect(view.bodySprite.texture).toBe("hero-body-male-sword-attack");
    expect(view.bodySprite.frame).toBe(8); // row 2 * 4 columns + frame 0
    expect(timers).toHaveLength(1);
    expect(timers[0].config.delay).toBe(55);
    // Phaser fires repeat + 1 times: three frames plus the restore tick.
    expect(timers[0].config.repeat).toBe(3);

    timers[0].tick();
    expect(view.bodySprite.frame).toBe(9);

    timers[0].tick(3); // finish frames 2 and 3, then restore
    expect(view.bodySprite.texture).toBe("hero-body-male-sword");
    expect(view.bodySprite.frame).toBe(8);
    expect(view.acting).toBe(false);
  });

  it("plays the swing sheet for the normal attack too", () => {
    const scene = swordScene();
    attachTimerStub(scene);
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "kiem-lang-khach" }, "male");

    // The strike sheet opts into "basic", so the everyday swing uses it as well.
    expect(view.attack("basic")).toBe(true);
    expect(view.bodySprite.texture).toBe("hero-body-male-sword-attack");
  });

  it("walks the whole cycle without leaving the walk cycle suppressed", () => {
    const scene = swordScene();
    const timers = attachTimerStub(scene);
    const view = new HeroRigView(scene);
    view.set(6, { weapon: "kiem-lang-khach" }, "male");

    view.attack("slash");
    expect(view.acting).toBe(true);
    // The walk cycle must not fight the swing for the sprite.
    view.animate(Math.PI / 2);
    expect(view.bodySprite.texture).toBe("hero-body-male-sword-attack");

    timers[0].tick(4);
    expect(view.acting).toBe(false);
    view.animate(Math.PI / 2);
    expect(view.bodySprite.frame).toBe(5); // row 1 * 4 + walk column 1
  });

  it("falls back to the vector recoil when the swing sheet is missing", () => {
    const scene = makeSpriteScene(["hero-body-male", "hero-body-male-sword"]);
    const tweens = [];
    scene.tweens = {
      add: (config) => {
        tweens.push(config);
        return { stop() {} };
      }
    };
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "kiem-lang-khach" }, "male");

    expect(view.attack("slash")).toBe(false);
    expect(view.bodySprite.texture).toBe("hero-body-male-sword");
    expect(tweens).toHaveLength(1);
  });

  it("falls back when the hero wears a weapon without swing art", () => {
    const scene = makeSpriteScene(["hero-body-male"]);
    scene.tweens = { add: () => ({ stop() {} }) };
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "dao-lang-khach" }, "male");

    expect(view.attack("slash")).toBe(false);
  });

  it("stops a running swing when the look is rebuilt", () => {
    const scene = swordScene();
    const timers = attachTimerStub(scene);
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "kiem-lang-khach" }, "male");
    view.attack("slash");

    view.set(4, { weapon: "kiem-lang-khach" }, "male"); // turn to the back view

    expect(timers[0].removed).toBe(true);
    expect(view.attackTimer).toBeNull();
    expect(view.bodySprite.texture).toBe("hero-body-male-sword");
  });

  it("keeps the blade sheathed for skills that are not a slash", () => {
    const scene = swordScene();
    attachTimerStub(scene);
    scene.tweens = { add: () => ({ stop() {} }) };
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "kiem-lang-khach" }, "male");

    // A buff, a kick or a palm cast must not become a sword swing.
    expect(view.attack("aura")).toBe(false);
    expect(view.attack("kick")).toBe(false);
    expect(view.attack("shockwave")).toBe(false);
    expect(view.bodySprite.texture).toBe("hero-body-male-sword");
  });

  it("cancels a swing back to the walk pose when a non-slash action starts", () => {
    const scene = swordScene();
    const timers = attachTimerStub(scene);
    scene.tweens = { add: () => ({ stop() {} }) };
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "kiem-lang-khach" }, "male");
    view.attack("slash");
    expect(view.bodySprite.texture).toBe("hero-body-male-sword-attack");

    view.attack("kick");

    expect(timers[0].removed).toBe(true);
    expect(view.bodySprite.texture).toBe("hero-body-male-sword");
    expect(view.bodySprite.frame).toBe(8);
  });

  it("waits for the walk sheet before swinging its attack art", () => {
    // The swing sheet landed first, so the body still wears the plain sheet
    // with a vector blade: the baked sword would double it.
    const scene = makeSpriteScene([
      "hero-body-male",
      "hero-body-male-sword-attack"
    ]);
    attachTimerStub(scene);
    scene.tweens = { add: () => ({ stop() {} }) };
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "kiem-lang-khach" }, "male");

    expect(view.attack("slash")).toBe(false);
    expect(view.bodySprite.texture).toBe("hero-body-male");
  });

  it("swings the female sword art for a female hero", () => {
    const scene = makeSpriteScene([
      "hero-body-female",
      "hero-body-female-sword",
      "hero-body-female-sword-attack"
    ]);
    const timers = attachTimerStub(scene);
    const view = new HeroRigView(scene);
    view.set(2, { weapon: "kiem-lang-khach" }, "female");
    expect(view.bodySprite.texture).toBe("hero-body-female-sword");

    expect(view.attack("slash")).toBe(true);
    expect(view.bodySprite.texture).toBe("hero-body-female-sword-attack");

    timers[0].tick(4);
    expect(view.bodySprite.texture).toBe("hero-body-female-sword");
  });
});

describe("HeroRigView bare-hand strike", () => {
  // The palm art holds no weapon, so the walk sheet stays the plain one and
  // only the strike frames come from the fist sheet.
  const fistScene = () =>
    makeSpriteScene(["hero-body-male", "hero-body-male-fist-attack"]);
  const wearGloves = { weapon: "bao-tay-lang-khach" };

  it("plays the palm sheet for the normal attack and a palm cast", () => {
    for (const kind of ["basic", "shockwave"]) {
      const scene = fistScene();
      const timers = attachTimerStub(scene);
      const view = new HeroRigView(scene);
      view.set(2, wearGloves, "male"); // faces right (row 2)
      expect(view.bodySprite.texture).toBe("hero-body-male");

      expect(view.attack(kind)).toBe(true);
      expect(view.bodySprite.texture).toBe("hero-body-male-fist-attack");
      expect(view.bodySprite.frame).toBe(8); // row 2 * 4 columns + frame 0

      timers[0].tick(4);
      expect(view.bodySprite.texture).toBe("hero-body-male");
      expect(view.bodySprite.frame).toBe(8);
    }
  });

  it("keeps the vector pose for motions the art was not drawn for", () => {
    const scene = fistScene();
    attachTimerStub(scene);
    scene.tweens = { add: () => ({ stop() {} }) };
    const view = new HeroRigView(scene);
    view.set(2, wearGloves, "male");

    // A kick, a buff and a slash-flavoured fist skill are not a palm strike.
    for (const kind of ["kick", "aura", "slash"]) {
      expect(view.attack(kind)).toBe(false);
    }
    expect(view.bodySprite.texture).toBe("hero-body-male");
  });

  it("treats a bare call as the normal attack", () => {
    const scene = fistScene();
    const timers = attachTimerStub(scene);
    const view = new HeroRigView(scene);
    view.set(2, wearGloves, "male");

    expect(view.attack()).toBe(true);
    timers[0].tick(4);
    expect(view.bodySprite.texture).toBe("hero-body-male");
  });

  it("keeps the glove on when the strike art has not loaded yet", () => {
    // An unloaded sheet must degrade to the vector pose, not to a gloveless
    // hero frozen on a strike frame.
    const scene = makeSpriteScene(["hero-body-male"]);
    attachTimerStub(scene);
    scene.tweens = { add: () => ({ stop() {} }) };
    const view = new HeroRigView(scene);
    view.set(2, wearGloves, "male");

    expect(view.attack("basic")).toBe(false);
    expect(view.weaponOverlays.every((overlay) => overlay.visible)).toBe(true);
  });

  it("hides the vector glove while the art draws the hands", () => {
    const scene = fistScene();
    const timers = attachTimerStub(scene);
    const view = new HeroRigView(scene);
    view.set(2, wearGloves, "male");

    expect(view.weaponOverlays.length).toBeGreaterThan(0);
    expect(view.weaponOverlays.every((overlay) => overlay.visible)).toBe(true);

    view.attack("basic");
    expect(view.weaponOverlays.every((overlay) => overlay.visible === false)).toBe(true);

    timers[0].tick(4);
    expect(view.weaponOverlays.every((overlay) => overlay.visible === true)).toBe(true);
  });

  it("shows the glove again when the strike is cancelled", () => {
    const scene = fistScene();
    const timers = attachTimerStub(scene);
    scene.tweens = { add: () => ({ stop() {} }) };
    const view = new HeroRigView(scene);
    view.set(2, wearGloves, "male");

    view.attack("basic");
    view.attack("kick"); // a cancelled strike must not leave the glove hidden
    expect(timers[0].removed).toBe(true);
    expect(view.weaponOverlays.every((overlay) => overlay.visible)).toBe(true);
  });

  it("plays the female palm art for a female hero", () => {
    const scene = makeSpriteScene(["hero-body-female", "hero-body-female-fist-attack"]);
    const timers = attachTimerStub(scene);
    const view = new HeroRigView(scene);
    view.set(2, wearGloves, "female");
    expect(view.bodySprite.texture).toBe("hero-body-female");

    expect(view.attack("shockwave")).toBe(true);
    expect(view.bodySprite.texture).toBe("hero-body-female-fist-attack");

    timers[0].tick(4);
    expect(view.bodySprite.texture).toBe("hero-body-female");
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
