/**
 * Map renderer.
 *
 * Everything here is driven by a MapDefinition (see `maps/mapRegistry.js`), so the
 * same class paints Biện Kinh's brick market and Đông Môn Thành's walled town.
 * The class never imports a layout directly and tracks every object it creates so
 * `destroy()` can hand the scene back clean before another map is loaded.
 */

import { toIso, isoDepth } from "./isoProjection.js";
import { WORLD_SCALE } from "./worldConfig.js";
import { createShop } from "./marketBuildings.js";
import { createVegetation } from "./marketProps.js";

const S = WORLD_SCALE;
const GROUND_DEPTH = -100000;
/** Thickness of the stone kerb that edges a walkway. */
const KERB = 14;

/**
 * Deterministic 0–1 noise, so ground detail is identical on every reload.
 * @param {number} seed
 * @param {number} salt
 * @param {number} offset
 */
const seeded = (seed, salt = 12.9898, offset = 78.233) => {
  const v = Math.sin(seed * salt + offset) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Renders one map from its definition.
 * Public surface: create(map), destroy(), getObstacles(), addBody().
 */
export class WorldManager {
  /** @param {import("phaser").Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.obstacles = null;
    this.map = null;
    /** Every GameObject this manager created, so destroy() can remove them. */
    this.tracked = [];
  }

  /** @param {object} obj */
  track(obj) {
    if (obj) this.tracked.push(obj);
    return obj;
  }

  /**
   * Build the map: ground, props, walls, decorations, portals and collision.
   * @param {import("./maps/mapRegistry.js").MapDefinition} map
   */
  create(map) {
    this.map = map;
    this.obstacles = this.scene.physics.add.staticGroup();

    this.drawGround();
    this.drawBuildings();
    this.drawVegetation();
    this.drawWalls();
    this.drawGates();
    this.drawBanners();
    this.drawBraziers();
    this.drawPortals();
    this.drawWorldBorder();
  }

  /** Remove everything this manager created. Safe to call more than once. */
  destroy() {
    this.tracked.forEach((obj) => obj?.destroy?.());
    this.tracked = [];

    if (this.obstacles) {
      try {
        this.obstacles.clear(true, true);
        this.obstacles.destroy(true);
      } catch {
        // Phaser may already have torn the static group down (scene shutdown).
      }
      this.obstacles = null;
    }
    this.map = null;
  }

  addBody(cx, cy, w, d) {
    if (!this.obstacles) return null;
    const col = this.obstacles.create(cx, cy, "entity-dot");
    col.setSize(w, d);
    col.setVisible(false);
    col.refreshBody();
    return col;
  }

  get bounds() {
    return this.map?.bounds || { x0: 0, y0: 0, x1: 0, y1: 0 };
  }

  drawGround() {
    const B = this.bounds;
    const ground = this.map?.ground || {};
    const pad = ground.pad ?? 320;

    const g = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH));

    // Grass rim just outside the playable area, so camera bounds never show
    // the page background.
    g.fillStyle(ground.rim ?? 0x53603f, 1);
    g.fillRect(B.x0 - pad, B.y0 - pad, B.x1 - B.x0 + pad * 2, B.y1 - B.y0 + pad * 2);

    // Packed earth under the brick so the repeated texture reads a little softer.
    g.fillStyle(ground.fill ?? 0x8a8272, 1);
    g.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);

    // Brick floor fills the whole playable map, exactly at the map bounds.
    const floor = this.scene.add.tileSprite(
      B.x0 + (B.x1 - B.x0) / 2,
      B.y0 + (B.y1 - B.y0) / 2,
      B.x1 - B.x0,
      B.y1 - B.y0,
      ground.tileKey || "ground-bricks"
    );
    floor.setAlpha(ground.tileAlpha ?? 0.94).setDepth(GROUND_DEPTH + 1);
    this.track(floor);

    this.drawGroundStains();

    if (ground.walkway) this.drawWalkway();

    if (ground.medallions?.length) this.drawGroundDetails();
  }

  /**
   * A street laid in a second brick style with stone kerbs, so it stands out from
   * the square it crosses.
   */
  drawWalkway() {
    const W = this.map.ground.walkway;
    const cx = W.x + W.w / 2;
    const cy = W.y + W.d / 2;
    const rotation = W.rotation ?? 0;

    // The sprite is sized to the rotated rectangle's bounding box, then masked
    // back down to the street.
    const spriteW = W.w * 1.05;
    const spriteH = W.d * 1.8;

    const paving = this.scene.add
      .tileSprite(cx, cy, spriteW, spriteH, W.tileKey || "ground-walkway")
      .setRotation(rotation)
      .setTileScale(W.tileScale ?? 0.55)
      .setTint(W.tint ?? 0xb0a288)
      .setAlpha(0.97)
      .setDepth(GROUND_DEPTH + 3);
    this.track(paving);

    const clip = this.scene.make.graphics({ add: false });
    clip.fillStyle(0xffffff, 1);
    clip.fillRect(W.x, W.y, W.w, W.d);
    paving.setMask(clip.createGeometryMask());

    // Faint wear so the road does not read as a flat recoloured strip.
    const grime = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 3.5));
    const wear = (seed) => seeded(seed, 53.17, 0);
    for (let i = 0; i < 14; i++) {
      const gx = W.x + wear(i * 2.3) * W.w;
      const gy = W.y + wear(i * 4.7 + 1) * W.d;
      const gw = 220 + wear(i * 6.1) * 420;
      const gh = 90 + wear(i * 8.3) * 140;
      grime.fillStyle(0x4b463c, 0.08);
      grime.fillEllipse(gx, gy, gw, gh);
    }

    // Stone kerbs along both long edges so the paving sits above the square.
    const kerb = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 4));
    kerb.fillStyle(0x5d574b, 0.95);
    kerb.fillRect(W.x, W.y - KERB, W.w, KERB);
    kerb.fillRect(W.x, W.y + W.d, W.w, KERB);
    // End cap where the street finishes.
    kerb.fillRect(W.x + W.w, W.y - KERB, KERB, W.d + KERB * 2);
    kerb.fillStyle(0x8b8474, 0.9);
    kerb.fillRect(W.x, W.y - KERB, W.w, 4);
    kerb.fillRect(W.x, W.y + W.d + KERB - 4, W.w, 4);
    kerb.lineStyle(2, 0x3e3a32, 0.35);
    kerb.lineBetween(W.x, W.y, W.x + W.w, W.y);
    kerb.lineBetween(W.x, W.y + W.d, W.x + W.w, W.y + W.d);
  }

  /** Broad dirt/lichen patches that break up the tiled brick pattern. */
  drawGroundStains() {
    const g = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 2));
    const B = this.bounds;

    for (let i = 0; i < 48; i++) {
      const x = B.x0 + seeded(i * 3.7) * (B.x1 - B.x0);
      const y = B.y0 + seeded(i * 7.1 + 2) * (B.y1 - B.y0);
      const w = 260 + seeded(i * 5.3) * 520;
      const h = w * (0.35 + seeded(i * 9.1) * 0.25);
      g.fillStyle(i % 3 ? 0x6b6354 : 0x5f6b4a, 0.16);
      g.fillEllipse(x, y, w, h);
    }
  }

  /** Medallions and hairline cracks so the pavement does not feel flat. */
  drawGroundDetails() {
    const g = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 5));
    const W = this.map.ground.walkway;
    const medallions = this.map.ground.medallions || [];

    medallions.forEach(({ x: mx, y: my, r }, index) => {
      g.lineStyle(5, 0x8f897b, 0.55);
      g.strokeCircle(mx, my, r);
      g.lineStyle(3, 0x9f998b, 0.45);
      g.strokeCircle(mx, my, r * 0.72);
      g.lineStyle(2, 0xb5af9f, 0.4);
      g.strokeCircle(mx, my, r * 0.44);
      if (index === 0) {
        // Small stone grate at the centre.
        g.fillStyle(0x6f6a5e, 0.9);
        g.fillRect(mx - 38, my - 26, 76, 52);
        g.fillStyle(0x413d35, 0.9);
        g.fillRect(mx - 30, my - 18, 60, 36);
        g.fillStyle(0x8d8779, 0.9);
        for (let i = 0; i < 4; i++) g.fillRect(mx - 26 + i * 16, my - 15, 5, 30);
      }
    });

    if (!W) return;
    g.lineStyle(2, 0x777163, 0.28);
    const crack = (seed) => seeded(seed, 91.733, 0);
    for (let i = 0; i < 60; i++) {
      const cx = W.x + 100 + crack(i * 1.7) * (W.w - 200);
      const cy = W.y + 40 + crack(i * 2.9 + 4) * (W.d - 80);
      g.lineBetween(cx, cy, cx + 18 + crack(i) * 38, cy + 4 + crack(i + 5) * 10);
    }
  }

  placeProp(obj, gx, gy, depthBias = 0) {
    const p = toIso(gx, gy);
    obj.setPosition(p.x, p.y);
    obj.setDepth(isoDepth(gx, gy) + depthBias);
    if (typeof obj.setScale === "function") obj.setScale(S);
    return this.track(obj);
  }

  drawBuildings() {
    (this.map?.buildings || []).forEach((def) => {
      const obj = createShop(this.scene, def);

      // def.x / def.y is the ground contact point at the centre of the facade.
      this.placeProp(obj, def.x, def.y);
      if (typeof def.scale === "number" && def.scale > 0) obj.setScale(def.scale);
      else obj.setScale(S * 0.68);

      this.addBody(def.x, def.y - 110, def.w * 0.9, 220);
    });
  }

  drawVegetation() {
    (this.map?.trees || []).forEach(([gx, gy, scale, kind]) => {
      const obj = createVegetation(this.scene, kind);
      this.placeProp(obj, gx, gy);
      obj.setScale(S * scale);
    });
    (this.map?.grass || []).forEach(([gx, gy, scale]) => {
      const obj = createVegetation(this.scene, "grass");
      this.placeProp(obj, gx, gy);
      obj.setScale(S * scale);
    });
  }

  /**
   * Town walls: a shadowed stone block with a lighter cap course, drawn at its
   * base depth so a wall in front of the hero still overlaps them correctly.
   */
  drawWalls() {
    (this.map?.walls || []).forEach((wall) => {
      const g = this.track(this.scene.add.graphics().setDepth(wall.y + wall.h));

      g.fillStyle(0x14161a, 0.3);
      g.fillRect(wall.x + 12, wall.y + 16, wall.w, wall.h);

      g.fillStyle(0x585d64, 1);
      g.fillRect(wall.x, wall.y, wall.w, wall.h);

      const capHeight = Math.min(22, wall.h * 0.4);
      g.fillStyle(0x767c85, 1);
      g.fillRect(wall.x, wall.y, wall.w, capHeight);

      g.lineStyle(3, 0x2f3338, 0.75);
      g.strokeRect(wall.x, wall.y, wall.w, wall.h);

      // Block joints, spaced so long walls read as masonry.
      g.lineStyle(1, 0x3c4148, 0.5);
      const step = 140;
      if (wall.w >= wall.h) {
        for (let x = wall.x + step; x < wall.x + wall.w; x += step) {
          g.lineBetween(x, wall.y + capHeight, x, wall.y + wall.h);
        }
      } else {
        for (let y = wall.y + step; y < wall.y + wall.h; y += step) {
          g.lineBetween(wall.x, y, wall.x + wall.w, y);
        }
      }

      this.addBody(wall.x + wall.w / 2, wall.y + wall.h / 2, wall.w, wall.h);
    });
  }

  /** Decorative gate arch: two posts and a lintel, no collision. */
  drawGates() {
    (this.map?.gates || []).forEach((gate) => {
      const g = this.track(this.scene.add.graphics().setDepth(gate.y + gate.h));
      const postWidth = 34;

      g.fillStyle(0x14161a, 0.3);
      g.fillRect(gate.x, gate.y - 6, gate.w, 24);

      // Posts on both sides of the opening.
      g.fillStyle(0x6a7079, 1);
      g.fillRect(gate.x, gate.y, postWidth, gate.h);
      g.fillRect(gate.x + gate.w - postWidth, gate.y, postWidth, gate.h);

      // Lintel and its shadow line.
      g.fillStyle(0x4a4f56, 1);
      g.fillRect(gate.x - 14, gate.y - 26, gate.w + 28, 34);
      g.fillStyle(0x2c3035, 1);
      g.fillRect(gate.x - 14, gate.y + 4, gate.w + 28, 8);

      // Lanterns flanking the arch.
      g.fillStyle(0xf0b45a, 0.9);
      g.fillCircle(gate.x + postWidth / 2, gate.y + 40, 9);
      g.fillCircle(gate.x + gate.w - postWidth / 2, gate.y + 40, 9);
    });
  }

  /** Banner poles along the avenue. */
  drawBanners() {
    (this.map?.banners || []).forEach(({ x, y }) => {
      const g = this.track(this.scene.add.graphics().setDepth(y));
      g.fillStyle(0x2a241c, 1);
      g.fillRect(x - 4, y - 220, 8, 220);
      g.fillStyle(0x9d2a25, 1);
      g.fillRect(x + 4, y - 214, 62, 22);
      g.fillStyle(0xd9b25a, 1);
      g.fillRect(x + 4, y - 214, 62, 4);
      g.fillStyle(0x2a241c, 0.28);
      g.fillEllipse(x, y + 2, 40, 10);
    });
  }

  /** Iron braziers with a small flame. */
  drawBraziers() {
    (this.map?.braziers || []).forEach(({ x, y }) => {
      const g = this.track(this.scene.add.graphics().setDepth(y));
      g.fillStyle(0x0f1113, 0.3);
      g.fillEllipse(x, y + 4, 54, 14);
      g.fillStyle(0x4a4f56, 1);
      g.fillRect(x - 4, y - 56, 8, 56);
      g.fillStyle(0x5f656e, 1);
      g.fillEllipse(x, y - 60, 40, 18);
      g.fillStyle(0xf0a53a, 0.95);
      g.fillEllipse(x, y - 74, 18, 26);
      g.fillStyle(0xffd98a, 0.95);
      g.fillEllipse(x, y - 78, 9, 14);
    });
  }

  /** Glowing ground strips that mark a travel portal. */
  drawPortals() {
    (this.map?.portals || []).forEach(({ rect }) => {
      const g = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 8));
      g.fillStyle(0x8fd8ff, 0.16);
      g.fillRect(rect.x, rect.y, rect.w, rect.h);
      g.lineStyle(4, 0x9fe8ff, 0.55);
      g.strokeRect(rect.x, rect.y, rect.w, rect.h);
      g.lineStyle(2, 0xffffff, 0.25);
      g.strokeRect(rect.x + 12, rect.y + 12, Math.max(0, rect.w - 24), Math.max(0, rect.h - 24));
    });
  }

  drawWorldBorder() {
    const B = this.bounds;
    const g = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 6));
    g.lineStyle(4, 0x71805d, 0.35);
    g.strokePoints(
      [
        toIso(B.x0, B.y0),
        toIso(B.x1, B.y0),
        toIso(B.x1, B.y1),
        toIso(B.x0, B.y1)
      ],
      true,
      true
    );
  }

  getObstacles() {
    return this.obstacles;
  }
}
