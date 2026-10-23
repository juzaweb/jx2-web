import { describe, expect, it } from "vitest";
import { VEGETATION_SPRITES, createVegetation } from "./marketProps.js";

const createFakeScene = () => {
  const image = {
    height: 100,
    scale: 1,
    setOrigin() {
      return this;
    },
    setScale(scale) {
      this.scale = scale;
      return this;
    }
  };
  const container = {
    children: [],
    add(child) {
      this.children.push(child);
    }
  };
  return {
    image,
    container,
    add: {
      image: () => image,
      container: () => container
    }
  };
};

describe("createVegetation", () => {
  it("scales the sprite to its rig-unit height", () => {
    const scene = createFakeScene();
    createVegetation(scene, "tree-large");
    expect(scene.image.scale).toBeCloseTo(VEGETATION_SPRITES["tree-large"].height / 100);
    expect(scene.container.children).toContain(scene.image);
  });

  it("anchors the sprite at its base", () => {
    const scene = createFakeScene();
    let origin = null;
    scene.image.setOrigin = (x, y) => {
      origin = [x, y];
      return scene.image;
    };
    createVegetation(scene, "grass");
    expect(origin).toEqual([0.5, 1]);
  });

  it("falls back to a bush for an unknown kind", () => {
    const scene = createFakeScene();
    createVegetation(scene, "not-a-plant");
    expect(scene.image.scale).toBeCloseTo(VEGETATION_SPRITES["bush-large"].height / 100);
  });
});
