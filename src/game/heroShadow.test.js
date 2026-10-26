import { describe, expect, it } from "vitest";
import { createHeroShadow } from "./heroShadow.js";

const makeScene = () => {
  const shapes = [];
  const scene = {
    add: {
      ellipse: (x, y, width, height, fillColor) => {
        const shape = {
          x,
          y,
          width,
          height,
          fillColor,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          setAlpha(value) {
            shape.alpha = value;
            return shape;
          },
          setScale(sx, sy) {
            shape.scaleX = sx;
            shape.scaleY = sy;
            return shape;
          }
        };
        shapes.push(shape);
        return shape;
      }
    }
  };
  return { scene, shapes };
};

describe("createHeroShadow", () => {
  it("starts faded instead of painting a solid black disc", () => {
    const { scene, shapes } = makeScene();

    createHeroShadow(scene, 41);

    // Remote-player avatars never call setFactor, so the alpha must be right on
    // creation — an opaque stack hides the auto-target ring under the feet.
    expect(shapes.map((shape) => shape.alpha)).toEqual([0.09, 0.16, 0.3]);
    expect(shapes.every((shape) => shape.fillColor === 0x000000)).toBe(true);
  });

  it("scales and fades every layer together", () => {
    const { scene, shapes } = makeScene();
    const shadow = createHeroShadow(scene, 41);

    shadow.setFactor(0.5);

    expect(shapes.map((shape) => shape.alpha)).toEqual([0.045, 0.08, 0.15]);
    expect(shapes.every((shape) => shape.scaleX === 0.5 && shape.scaleY === 0.5)).toBe(true);
  });
});
