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

export function createTree(scene) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x10170e, 0.3);
    g.fillEllipse(0, 6, 54, 16);
    g.fillStyle(0x51361f, 1);
    g.fillRect(-5, -34, 10, 38);
    g.fillStyle(0x3f522f, 1);
    g.fillCircle(0, -48, 23);
    g.fillStyle(0x4e6a39, 1);
    g.fillCircle(-15, -38, 17);
    g.fillCircle(16, -39, 16);
    g.fillStyle(0x62834a, 1);
    g.fillCircle(-6, -58, 14);
    g.fillCircle(9, -54, 12);
    c.add(g);
    return c;
  }

export function createPine(scene) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x10170e, 0.3);
    g.fillEllipse(0, 6, 46, 14);
    g.fillStyle(0x4a3120, 1);
    g.fillRect(-5, -42, 10, 46);
    g.fillStyle(0x2c4a33, 1);
    g.fillTriangle(0, -86, -33, -40, 33, -40);
    g.fillStyle(0x355c3d, 1);
    g.fillTriangle(0, -104, -26, -62, 26, -62);
    g.fillStyle(0x416f49, 1);
    g.fillTriangle(0, -118, -19, -84, 19, -84);
    c.add(g);
    return c;
  }

