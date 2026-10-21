import { WORLD_SCALE } from "./worldConfig.js";

const S = WORLD_SCALE;

/** Small market props and vegetation painters (ground-anchored containers). */

export function createCrates(scene) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x131710, 0.35);
    g.fillEllipse(0, 6, 64, 20);
    const box = (x, y, w, h) => {
      g.fillStyle(0x8a6237, 1);
      g.fillRect(x, y, w, h);
      g.lineStyle(2, 0x4e3318, 1);
      g.strokeRect(x, y, w, h);
      g.lineStyle(1.2, 0x5f411f, 0.9);
      g.lineBetween(x, y + h / 2, x + w, y + h / 2);
      g.lineBetween(x + w / 2, y, x + w / 2, y + h);
    };
    box(-26, -24, 26, 24);
    box(0, -24, 24, 24);
    box(-14, -48, 28, 24);
    c.add(g);
    return c;
  }

export function createSacks(scene) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x131710, 0.3);
    g.fillEllipse(0, 6, 72, 20);
    [[-18, -8, 26, 22], [10, -9, 30, 24], [-4, -28, 26, 22]].forEach(([x, y, w, h], i) => {
      g.fillStyle(i % 2 ? 0xcdb98f : 0xb9a379, 1);
      g.fillEllipse(x, y, w, h);
      g.lineStyle(1.5, 0x6f5b3b, 1);
      g.strokeEllipse(x, y, w, h);
      g.fillStyle(0xe6d6b0, 0.5);
      g.fillEllipse(x - 4, y - 4, w * 0.4, h * 0.35);
    });
    c.add(g);
    return c;
  }

export function createBarrel(scene) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x131710, 0.3);
    g.fillEllipse(0, 5, 40, 14);
    g.fillStyle(0x76502b, 1);
    g.fillRoundedRect(-15, -38, 30, 40, 8);
    g.lineStyle(2, 0x3c2513, 1);
    g.strokeRoundedRect(-15, -38, 30, 40, 8);
    g.lineStyle(3, 0x4d3a25, 1);
    g.lineBetween(-15, -28, 15, -28);
    g.lineBetween(-15, -10, 15, -10);
    g.fillStyle(0x9a6c3c, 1);
    g.fillEllipse(0, -38, 30, 10);
    c.add(g);
    return c;
  }

export function createJars(scene) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x131710, 0.3);
    g.fillEllipse(0, 6, 58, 18);
    [[-16, -10, 20, 26, 0x8e5a32], [12, -12, 24, 30, 0x5c6b48], [0, -32, 20, 24, 0xa06a3c]].forEach(([x, y, w, h, col]) => {
      g.fillStyle(col, 1);
      g.fillEllipse(x, y, w, h);
      g.lineStyle(1.5, 0x352113, 1);
      g.strokeEllipse(x, y, w, h);
      g.fillStyle(0x341f12, 1);
      g.fillRect(x - w * 0.22, y - h / 2 - 2, w * 0.44, 4);
      g.fillStyle(0xc8402f, 1);
      g.fillRect(x - w * 0.28, y - h / 2 - 4, w * 0.56, 3);
    });
    c.add(g);
    return c;
  }

export function createBasket(scene) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x131710, 0.25);
    g.fillEllipse(0, 4, 38, 12);
    g.fillStyle(0xa57b45, 1);
    g.fillEllipse(0, -6, 34, 22);
    g.lineStyle(1.5, 0x5e431f, 1);
    g.strokeEllipse(0, -6, 34, 22);
    g.fillStyle(0x4d7c2f, 1);
    g.fillEllipse(0, -9, 26, 14);
    g.fillStyle(0xd9a43c, 1);
    g.fillCircle(-5, -11, 4);
    g.fillCircle(5, -8, 3.5);
    c.add(g);
    return c;
  }

export function createStoneLantern(scene) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x12170f, 0.3);
    g.fillEllipse(0, 8, 42, 14);
    g.fillStyle(0x77705f, 1);
    g.fillRect(-15, -8, 30, 16);
    g.fillRect(-7, -38, 14, 30);
    g.fillRect(-16, -44, 32, 7);
    g.fillStyle(0xd9c47b, 1);
    g.fillRect(-9, -60, 18, 16);
    g.lineStyle(1.5, 0x5d5548, 1);
    g.strokeRect(-9, -60, 18, 16);
    g.lineStyle(1, 0x8b826e, 1);
    g.lineBetween(0, -60, 0, -44);
    g.lineBetween(-9, -52, 9, -52);
    g.fillStyle(0x5f594b, 1);
    g.fillPoints(
      [
        { x: -22, y: -60 },
        { x: 22, y: -60 },
        { x: 12, y: -72 },
        { x: -12, y: -72 }
      ],
      true
    );
    g.fillStyle(0x4a4539, 1);
    g.fillRect(-2, -80, 4, 8);
    c.add(g);
    return c;
  }

/**
 * Vegetation art cropped from the reference sheet, sized in rig units (the
 * caller applies the world scale on top). `height` is the rendered height, so
 * every kind lands at the same scale the procedural trees used.
 */
export const VEGETATION_SPRITES = {
  "tree-large": { key: "veg-tree-large", url: "/veg/tree-large.webp", height: 130 },
  "tree-medium": { key: "veg-tree-medium", url: "/veg/tree-medium.webp", height: 100 },
  "bush-large": { key: "veg-bush-large", url: "/veg/bush-large.webp", height: 58 },
  "bush-medium": { key: "veg-bush-medium", url: "/veg/bush-medium.webp", height: 52 },
  "bush-small": { key: "veg-bush-small", url: "/veg/bush-small.webp", height: 40 },
  grass: { key: "veg-grass", url: "/veg/grass.webp", height: 30 }
};

/**
 * Ground-anchored vegetation sprite. The container origin is the plant's base
 * so it lines up with the shadow and depth sorting like the other props.
 * @param {import("phaser").Scene} scene
 * @param {keyof typeof VEGETATION_SPRITES} kind
 */
export function createVegetation(scene, kind) {
  const def = VEGETATION_SPRITES[kind] || VEGETATION_SPRITES["bush-large"];
  const c = scene.add.container(0, 0);
  const img = scene.add.image(0, 0, def.key).setOrigin(0.5, 1);
  img.setScale(def.height / img.height);
  c.add(img);
  return c;
}

