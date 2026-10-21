import { describe, expect, it } from "vitest";
import { HeroRigView } from "./heroRigView.js";
import { HERO_BODY } from "./heroBody.js";

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

function makeSpriteScene() {
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
        frameSets: 0,
        setOrigin(ox, oy) {
          this.origin = [ox, oy];
          return this;
        },
        setScale(scale) {
          this.scale = scale;
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
      exists: (key) => key === "hero-body-male" || key === "hero-body-female"
    },
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

  it("draws equipment overlays on the baked body", () => {
    const scene = makeSpriteScene();
    const view = new HeroRigView(scene);

    view.set(2, { armor: "cam-y-bao", helmet: "tu-kim-quan" }, "male");

    expect(scene._container.children.length).toBeGreaterThan(1);
    expect(view.key).toContain("cam-y-bao");
  });
});
