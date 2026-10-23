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
/** How many irregular blobs soften the edges of a painted path. */
const PATH_EDGE_BLOBS = 44;
/** Vertical spread of those blobs, in world pixels. */
const PATH_EDGE_WOBBLE = 70;

/**
 * Ground tiles painted in code instead of shipped as images. Keyed by texture
 * key, each painter draws into a `size` × `size` graphics that is then generated
 * into a reusable texture.
 */
const PAINTED_GROUNDS = {
  "ground-forest": (g, size) => {
    g.fillStyle(0x3b4830, 1);
    g.fillRect(0, 0, size, size);

    const tones = [0x46553a, 0x33402b, 0x51603f, 0x2f3a28];
    for (let i = 0; i < 140; i++) {
      g.fillStyle(tones[i % tones.length], 0.5);
      g.fillEllipse(
        seeded(i * 1.7) * size,
        seeded(i * 2.9 + 1) * size,
        6 + seeded(i * 3.3) * 24,
        5 + seeded(i * 4.1) * 15
      );
    }

    // A few darker flecks read as leaf litter once tiled.
    g.fillStyle(0x27311f, 0.6);
    for (let i = 0; i < 40; i++) {
      g.fillCircle(seeded(i * 5.3 + 2) * size, seeded(i * 6.7 + 3) * size, 1.5);
    }
  }
};

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
   * Build the map: ground, buildings, vegetation, gates, portals, collision.
   * @param {import("./maps/mapRegistry.js").MapDefinition} map
   */
  create(map) {
    this.map = map;
    this.obstacles = this.scene.physics.add.staticGroup();

    this.drawGround();
    this.drawBuildings();
    this.drawVegetation();
    this.drawGates();
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

  /**
   * Ground textures that live in code rather than in `public/`. Painted once per
   * game, then tiled like any other texture.
   * @param {string} key
   * @returns {string} the key to tile
   */
  ensureGroundTexture(key) {
    const paint = PAINTED_GROUNDS[key];
    if (!paint || this.scene.textures.exists(key)) return key;

    const size = 96;
    const g = this.scene.make.graphics({ add: false });
    paint(g, size);
    g.generateTexture(key, size, size);
    g.destroy();
    return key;
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

    // The base tile fills the whole playable map, exactly at the map bounds.
    const floor = this.scene.add.tileSprite(
      B.x0 + (B.x1 - B.x0) / 2,
      B.y0 + (B.y1 - B.y0) / 2,
      B.x1 - B.x0,
      B.y1 - B.y0,
      this.ensureGroundTexture(ground.tileKey || "ground-bricks")
    );
    floor.setAlpha(ground.tileAlpha ?? 0.94).setDepth(GROUND_DEPTH + 1);
    this.track(floor);

    this.drawGroundRegions();
    this.drawGroundStains();
    this.drawStreets();

    if (ground.medallions?.length) this.drawGroundDetails();
  }

  /**
   * Broad regions painted over the base tile — a forest floor, a packed-earth
   * courtyard. Drawn under the streets so paths stay visible through them.
   */
  drawGroundRegions() {
    const regions = this.map?.ground?.regions || [];
    if (!regions.length) return;

    const g = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 1.5));
    regions.forEach((region) => {
      g.fillStyle(region.fill ?? 0x4a5440, region.alpha ?? 0.9);
      g.fillRect(region.x, region.y, region.w, region.h);
    });
  }

  /**
   * Every street/path the map defines, back to front. A street with a `fill` is
   * painted earth; one with a `tileKey` is paving.
   */
  drawStreets() {
    (this.map?.ground?.streets || []).forEach((street) => {
      if (street.fill !== undefined) this.drawPaintedPath(street);
      else this.drawPavedStreet(street);
    });
  }

  /**
   * A trodden path: a filled band of earth with ragged edges. No texture and no
   * kerbs — this is a forest trail, not a road.
   * @param {{x:number, y:number, w:number, d:number, fill:number, alpha?:number}} W
   */
  drawPaintedPath(W) {
    const g = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 3));
    g.fillStyle(W.fill, W.alpha ?? 0.9);
    g.fillRect(W.x, W.y, W.w, W.d);

    // Blobs straddling both long edges, so the path does not end on a ruler line.
    const jitter = (seed) => seeded(seed, 71.3, 0);
    const centred = (seed) => (jitter(seed) - 0.5) * PATH_EDGE_WOBBLE;

    for (let i = 0; i < PATH_EDGE_BLOBS; i++) {
      const gx = W.x + jitter(i * 1.9) * W.w;
      const blobW = 100 + jitter(i) * 130;
      const blobH = 70 + jitter(i + 3) * 60;
      g.fillEllipse(gx, W.y + centred(i * 2.7), blobW, blobH);
      g.fillEllipse(gx, W.y + W.d + centred(i * 3.1), blobW, blobH);
    }
  }

  /**
   * A paved street: a masked, rotated paving strip with stone kerbs (unless the
   * map asks for a kerbless track).
   * @param {object} W street definition
   */
  drawPavedStreet(W) {
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
      // A trail lets the ground underneath show through; a town street is solid.
      .setAlpha(W.alpha ?? 0.97)
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

    if (W.kerb === false) return;

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
    // Cracks follow the first (town) street; a forest map has none to follow.
    const W = this.map.ground.streets?.[0];
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

  /** A glowing rune circle on the ground that marks a travel portal. */
  drawPortals() {
    (this.map?.portals || []).forEach(({ rect }) => {
      const g = this.track(this.scene.add.graphics().setDepth(GROUND_DEPTH + 8));
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;

      // Soft glow, so the circle sits in grass rather than on top of it.
      g.fillStyle(0x8fd8ff, 0.1);
      g.fillEllipse(cx, cy, rect.w, rect.h);
      g.lineStyle(3, 0x9fe8ff, 0.45);
      g.strokeEllipse(cx, cy, rect.w, rect.h);
      g.lineStyle(2, 0xffffff, 0.2);
      g.strokeEllipse(cx, cy, rect.w * 0.62, rect.h * 0.62);

      // Rune ticks between the two rings.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.lineBetween(
          cx + Math.cos(a) * rect.w * 0.33,
          cy + Math.sin(a) * rect.h * 0.33,
          cx + Math.cos(a) * rect.w * 0.41,
          cy + Math.sin(a) * rect.h * 0.41
        );
      }
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
