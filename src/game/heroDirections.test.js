import { describe, expect, it, vi } from "vitest";
import {
  directionFromVelocity,
  frameIndex,
  idleFrame,
  walkAnimKey,
  walkFrames,
  ensureHeroWalkAnims
} from "./heroDirections.js";

describe("directionFromVelocity", () => {
  it("maps the four cardinal world axes to the correct screen-facing column", () => {
    // World axes are projected isometrically, so +x renders down-right, +y
    // down-left, -x up-left and -y up-right.
    expect(directionFromVelocity(1, 0)).toBe(1);
    expect(directionFromVelocity(0, 1)).toBe(7);
    expect(directionFromVelocity(-1, 0)).toBe(5);
    expect(directionFromVelocity(0, -1)).toBe(3);
  });

  it("maps the world diagonals to the vertical screen columns", () => {
    // +x-y renders straight right, +x+y straight down, -x-y straight left,
    // -x+y straight up.
    expect(directionFromVelocity(1, -1)).toBe(2);
    expect(directionFromVelocity(1, 1)).toBe(0);
    expect(directionFromVelocity(-1, -1)).toBe(4);
    expect(directionFromVelocity(-1, 1)).toBe(6);
  });

  it("always returns a column in range", () => {
    for (let a = 0; a < 360; a += 7) {
      const column = directionFromVelocity(Math.cos(a), Math.sin(a));
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThanOrEqual(7);
    }
  });
});

describe("frame layout", () => {
  it("reads the sheet row-major at 8 columns per row", () => {
    expect(frameIndex(0, 0)).toBe(0);
    expect(frameIndex(7, 0)).toBe(7);
    expect(frameIndex(3, 2)).toBe(19);
    expect(idleFrame(5)).toBe(5);
  });

  it("lists the 5 walk rows for a column in order", () => {
    expect(walkFrames(2)).toEqual([10, 18, 26, 34, 42]);
  });
});

describe("ensureHeroWalkAnims", () => {
  const makeScene = ({ exists = true, animExists = false } = {}) => {
    const created = [];
    return {
      created,
      scene: {
        textures: { exists: () => exists },
        anims: {
          exists: () => animExists,
          create: (config) => created.push(config)
        }
      }
    };
  };

  it("creates one looping animation per direction", () => {
    const { scene, created } = makeScene();
    expect(ensureHeroWalkAnims(scene)).toBe(true);
    expect(created).toHaveLength(8);
    expect(created.map((a) => a.key)).toEqual(
      Array.from({ length: 8 }, (_, c) => walkAnimKey(c))
    );
    expect(created[0].frames.map((f) => f.frame)).toEqual(walkFrames(0));
    expect(created[0].repeat).toBe(-1);
  });

  it("does nothing when the sheet is missing", () => {
    const { scene, created } = makeScene({ exists: false });
    expect(ensureHeroWalkAnims(scene)).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("skips animations that already exist", () => {
    const { scene, created } = makeScene({ animExists: true });
    expect(ensureHeroWalkAnims(scene)).toBe(true);
    expect(created).toHaveLength(0);
  });
});
